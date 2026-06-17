import { beforeEach, describe, expect, it, vi } from "vitest";

const writeCanonicalEventMock = vi.fn(async () => undefined);
const putPdfObjectMock = vi.fn(async ({ objectKey }: { objectKey: string }) => ({
  bucket: "lease-documents",
  path: objectKey,
}));
const getSignedDownloadUrlMock = vi.fn(async () => "https://signed.example.com/provider-access.pdf");

const { fakeDb, listDocs, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; value: any }>) {
    return filters.every(({ field, value }) => doc.data?.[field] === value);
  }

  function makeDoc(name: string, id?: string) {
    const actualId = id || `doc_${++idSeq}`;
    const col = ensureCollection(name);
    return {
      id: actualId,
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = col.get(actualId)?.data || {};
        col.set(actualId, { id: actualId, data: options?.merge ? { ...current, ...value } : value });
      },
      get: async () => {
        const entry = col.get(actualId);
        return { id: actualId, exists: Boolean(entry), data: () => entry?.data };
      },
    };
  }

  function makeQuery(name: string, filters: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) => makeQuery(name, [...filters, { field, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, data: doc.data })),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, _op: string, value: any) => makeQuery(name, [{ field, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../../firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../../../storage/pdfStore", () => ({
  putPdfObject: putPdfObjectMock,
}));

vi.mock("../../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

vi.mock("../../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: writeCanonicalEventMock,
}));

function lease(overrides: Record<string, any> = {}) {
  return {
    id: "lease-1",
    landlordId: "landlord-1",
    tenantIds: ["tenant-1"],
    province: "NS",
    propertyId: "prop-1",
    unitId: "unit-1",
    unitNumber: "101",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    termType: "fixed",
    baseRentCents: 180000,
    dueDay: 1,
    paymentMethod: "etransfer",
    ...overrides,
  };
}

describe("leaseDocumentService", () => {
  beforeEach(() => {
    resetFakeDb();
    writeCanonicalEventMock.mockClear();
    putPdfObjectMock.mockClear();
    getSignedDownloadUrlMock.mockClear();
    process.env.NODE_ENV = "test";
    process.env.SIGNING_DOCUMENT_SOURCE_TEST_MODE = "true";
    delete process.env.LEASE_DOCUMENT_GENERATION_TEST_MODE;
    delete process.env.SIGNING_PROVIDER_TEST_MODE;
    process.env.GCS_UPLOAD_BUCKET = "lease-documents";
  });

  it("generates CA_NS primary lease documents in explicit test mode with safe metadata", async () => {
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    const document = await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: { name: "Landlord" },
      property: { name: "Harbour View" },
      unit: { unitNumber: "101" },
      tenants: [{ fullName: "Tenant One" }],
      actorId: "actor-1",
    });

    expect(document.documentType).toBe("primary_lease");
    expect(document.jurisdictionCode).toBe("CA_NS");
    expect(document.templateEffectiveDate).toBe("2026-06-15");
    expect(document.counselReviewStatus).toBe("draft");
    expect(document.sourceReferences).toEqual(["Nova Scotia Form P Standard Lease Form reference upload"]);
    expect(document.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.storageRef).toBeNull();
    expect((document as any).signingFieldPlacement).toBeUndefined();
    expect(JSON.stringify(document)).not.toContain("lease-documents/");
    expect(listDocs("leaseDocuments")).toHaveLength(1);
    expect(listDocs("leaseDocuments")[0].data.signingFieldPlacement).toEqual(
      expect.objectContaining({
        provider: "dropbox_sign",
        placementVersion: "dropbox_sign_form_fields_v1",
        landlordPlacementPrepared: true,
        fields: expect.arrayContaining([
          expect.objectContaining({
            apiId: "tenant_signature",
            type: "signature",
            signerRole: "tenant",
            signerIndex: 0,
          }),
          expect.objectContaining({
            apiId: "tenant_date_signed",
            type: "date_signed",
            signerRole: "tenant",
            signerIndex: 0,
          }),
        ]),
      })
    );
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lease_document_generated",
        metadata: expect.objectContaining({
          templateEffectiveDate: "2026-06-15",
          sourceReferences: ["Nova Scotia Form P Standard Lease Form reference upload"],
        }),
      })
    );
  });

  it("fails closed for missing jurisdiction adapters without success events", async () => {
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    await expect(
      generatePrimaryLeaseDocument({
        leaseId: "lease-1",
        lease: lease({ province: "ON" }),
        landlord: null,
        property: null,
        unit: null,
        tenants: [],
        actorId: "actor-1",
      })
    ).rejects.toThrow("jurisdiction_template_unavailable");
    expect(listDocs("leaseDocuments")).toHaveLength(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("fails closed for draft adapters outside allowed test mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.SIGNING_DOCUMENT_SOURCE_TEST_MODE = "false";
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    await expect(
      generatePrimaryLeaseDocument({
        leaseId: "lease-1",
        lease: lease(),
        landlord: null,
        property: null,
        unit: null,
        tenants: [],
        actorId: "actor-1",
      })
    ).rejects.toThrow("jurisdiction_template_unavailable");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("allows draft CA_NS generation in explicit lease document generation test mode", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SIGNING_DOCUMENT_SOURCE_TEST_MODE;
    process.env.LEASE_DOCUMENT_GENERATION_TEST_MODE = "true";
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    const document = await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });

    expect(document.jurisdictionCode).toBe("CA_NS");
    expect(document.counselReviewStatus).toBe("draft");
    expect(document.sourceSummary).toEqual(
      expect.objectContaining({
        productionApproved: false,
        signingEnabled: false,
      })
    );
  });

  it("allows preview generation when signing provider test mode is explicitly enabled", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SIGNING_DOCUMENT_SOURCE_TEST_MODE;
    delete process.env.LEASE_DOCUMENT_GENERATION_TEST_MODE;
    process.env.SIGNING_PROVIDER_TEST_MODE = "true";
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    const document = await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });

    expect(document.counselReviewStatus).toBe("draft");
    expect(document.sourceSummary?.productionApproved).toBe(false);
    expect(document.sourceSummary?.signingEnabled).toBe(false);
  });

  it("locks generated primary documents for signing and returns provider-readable URL", async () => {
    const { generatePrimaryLeaseDocument, lockPrimaryLeaseDocumentForSigning } = await import("../leaseDocumentService");
    const generated = await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });

    const locked = await lockPrimaryLeaseDocumentForSigning({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      actorId: "actor-1",
      signingRequestId: "request-1",
    });

    expect(locked.document.id).toBe(generated.id);
    expect(locked.document.status).toBe("locked");
    expect(locked.providerDocumentUrl).toBe("https://signed.example.com/provider-access.pdf");
    expect(getSignedDownloadUrlMock).toHaveBeenCalledWith(expect.objectContaining({ expiresMinutes: 240 }));
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(expect.objectContaining({ action: "lease_document_locked" }));
  });

  it("does not mutate a locked document during signing", async () => {
    const { generatePrimaryLeaseDocument, lockPrimaryLeaseDocumentForSigning } = await import("../leaseDocumentService");
    await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });
    await lockPrimaryLeaseDocumentForSigning({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      actorId: "actor-1",
      signingRequestId: "request-1",
    });

    await expect(
      generatePrimaryLeaseDocument({
        leaseId: "lease-1",
        lease: lease(),
        landlord: null,
        property: null,
        unit: null,
        tenants: [],
        actorId: "actor-1",
      })
    ).rejects.toThrow("lease_document_locked");

    const documents = listDocs("leaseDocuments");
    expect(documents).toHaveLength(1);
    expect(documents[0].data.status).toBe("locked");
  });

  it("supersedes generated primary documents and writes a safe canonical event", async () => {
    const { generatePrimaryLeaseDocument } = await import("../leaseDocumentService");
    await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease(),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });
    await generatePrimaryLeaseDocument({
      leaseId: "lease-1",
      lease: lease({ baseRentCents: 190000 }),
      landlord: null,
      property: null,
      unit: null,
      tenants: [],
      actorId: "actor-1",
    });

    const documents = listDocs("leaseDocuments");
    expect(documents).toHaveLength(2);
    expect(documents.map((doc) => doc.data.status).sort()).toEqual(["generated", "superseded"]);
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(expect.objectContaining({ action: "lease_document_superseded" }));
    expect(JSON.stringify(writeCanonicalEventMock.mock.calls)).not.toContain("lease-documents/");
  });

  it("does not sign superseded documents", async () => {
    seedDoc("leaseDocuments", "old-doc", {
      id: "old-doc",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      status: "superseded",
      generatedAt: "2026-01-01T00:00:00.000Z",
      storageRef: { bucket: "lease-documents", path: "lease-documents/raw.pdf" },
    });
    const { lockPrimaryLeaseDocumentForSigning } = await import("../leaseDocumentService");
    await expect(
      lockPrimaryLeaseDocumentForSigning({ leaseId: "lease-1", landlordId: "landlord-1" })
    ).rejects.toThrow("signing_document_url_required");
  });

  it("allows future US adapters through the registry without changing the core pipeline", async () => {
    const { registerLeaseDocumentAdapter, getLeaseDocumentAdapter } = await import("../jurisdictionAdapterRegistry");
    registerLeaseDocumentAdapter({
      jurisdictionCode: "US_ME",
      templateVersion: "us-me-test-v1",
      effectiveDate: "2026-06-15",
      counselReviewStatus: "draft",
      signingEnabled: false,
      productionApproved: false,
      requiredSections: [],
      requiredDisclosures: [],
      requiredNotices: [],
      prohibitedClauseChecks: [],
      languageRequirements: ["en-US"],
      statutoryReferences: [],
      sourceReferences: [],
      renderPrimaryLeasePdf: async () => Buffer.from("pdf"),
    });
    expect(getLeaseDocumentAdapter("US_ME")).toEqual(expect.objectContaining({ jurisdictionCode: "US_ME" }));
  });
});
