import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantDocs = new Map<string, any>();
const propertyDocs = new Map<string, any>();
const unitDocs = new Map<string, any>();
const leaseDocs = new Map<string, any>();
const signingRequestDocs = new Map<string, any>();
const canonicalEventDocs = new Map<string, any>();
const getSignedLeaseDocumentDownloadMock = vi.hoisted(() => vi.fn());

function collectionFor(name: string) {
  if (name === "tenants") return tenantDocs;
  if (name === "properties") return propertyDocs;
  if (name === "units") return unitDocs;
  if (name === "leases") return leaseDocs;
  if (name === "leaseSigningRequests") return signingRequestDocs;
  if (name === "canonicalEvents") return canonicalEventDocs;
  return new Map<string, any>();
}

function makeCollection(name: string) {
  const docs = collectionFor(name);
  const makeDoc = (id: string) => ({
    id,
    get: async () => ({
      id,
      exists: docs.has(id),
      data: () => docs.get(id),
    }),
  });
  const makeQuery = (filters: Array<{ field: string; value: any }> = []) => ({
    where: (field: string, _op: string, value: any) => makeQuery([...filters, { field, value }]),
    limit: () => makeQuery(filters),
    orderBy: () => makeQuery(filters),
    doc: makeDoc,
    get: async () => {
      const matched = Array.from(docs.entries()).filter(([, data]) =>
        filters.every(({ field, value }) => data?.[field] === value)
      );
      return {
        docs: matched.map(([id, data]) => ({ id, exists: true, data: () => data })),
        forEach: (callback: (doc: any) => void) => {
          for (const [id, data] of matched) callback({ id, exists: true, data: () => data });
        },
      };
    },
  });
  return {
    doc: makeDoc,
    where: (field: string, _op: string, value: any) => makeQuery([{ field, value }]),
    limit: () => makeQuery(),
    orderBy: () => makeQuery(),
    get: () => makeQuery().get(),
  };
}

vi.mock("../../firebase", () => ({
  db: {
    collection: makeCollection,
  },
}));

vi.mock("../leaseNoticeWorkflowService", async () => {
  const actual = await vi.importActual<any>("../leaseNoticeWorkflowService");
  return {
    ...actual,
    computeNoResponseState: vi.fn(),
    getLeaseNoticeByLeaseId: vi.fn(async () => []),
  };
});

vi.mock("../leaseCanonicalizationService", async () => {
  const actual = await vi.importActual<any>("../leaseCanonicalizationService");
  return {
    ...actual,
    loadUnitsForProperty: vi.fn(async (_db: any, propertyId: string, landlordId?: string | null) =>
      Array.from(unitDocs.entries())
        .filter(([, data]) => data?.propertyId === propertyId && (!landlordId || data?.landlordId === landlordId))
        .map(([id, raw]) => ({
          id,
          landlordId: raw.landlordId ?? null,
          propertyId: raw.propertyId ?? null,
          unitNumber: raw.unitNumber ?? null,
          label: raw.label ?? raw.unitLabel ?? raw.unitNumber ?? null,
          rent: raw.rent ?? null,
          raw,
        }))
    ),
    resolveUnitReference: vi.fn((units: any[], reference: any) => {
      const target = String(reference || "").trim().toLowerCase();
      const unit = units.find((candidate) =>
        [candidate.id, candidate.unitNumber, candidate.label]
          .map((value) => String(value || "").trim().toLowerCase())
          .includes(target)
      );
      return { unit: unit || null, matchedBy: unit ? "test" : null, ambiguous: false, candidateIds: unit ? [unit.id] : [] };
    }),
  };
});

vi.mock("../leasePartyConsolidationService", async () => vi.importActual("../leasePartyConsolidationService"));

vi.mock("../risk/credibilityInsights", () => ({
  buildCredibilityInsights: vi.fn(() => null),
}));

vi.mock("../moveInRequirements", async () => vi.importActual("../moveInRequirements"));

vi.mock("../tenantMoveInReadinessService", () => ({
  buildMoveInReadinessRecord: vi.fn(() => null),
  getPersistedMoveInReadinessRecord: vi.fn(async () => null),
  listMoveInReadinessEvents: vi.fn(async () => []),
}));

vi.mock("../tenanciesService", () => ({
  buildDerivedTenancyFromTenant: vi.fn(() => null),
  listTenanciesByTenantId: vi.fn(async () => []),
}));

vi.mock("../signing/leaseSigningService", () => ({
  getSignedLeaseDocumentDownload: getSignedLeaseDocumentDownloadMock,
}));

describe("getTenantsList", () => {
  beforeEach(() => {
    tenantDocs.clear();
    propertyDocs.clear();
    unitDocs.clear();
    leaseDocs.clear();
    signingRequestDocs.clear();
    canonicalEventDocs.clear();
    tenantDocs.set("tenant-visible", {
      landlordId: "landlord-1",
      fullName: "Visible Tenant",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    tenantDocs.set("tenant-hidden", {
      landlordId: "landlord-1",
      fullName: "Hidden Tenant",
      hiddenFromActiveLists: true,
      createdAt: "2026-01-03T00:00:00.000Z",
    });
  });

  it("excludes hidden tenants from landlord active lists when requested", async () => {
    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
      excludeHiddenFromActiveLists: true,
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-visible"]);
  });

  it("preserves hidden tenants when explicit filtering is not requested", async () => {
    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual([
      "tenant-hidden",
      "tenant-visible",
    ]);
  });

  it("hides the targeted test-tenant ids even if the cleanup flag was never written", async () => {
    tenantDocs.set("c43992df00d07acae140ba76", {
      landlordId: "landlord-1",
      fullName: "test2",
      createdAt: "2026-01-04T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
      excludeHiddenFromActiveLists: true,
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-visible"]);
  });

  it("returns persisted converted tenants without appending in-memory duplicates", async () => {
    tenantDocs.clear();
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const first = await getTenantsList({ landlordId: "landlord-1" });
    const second = await getTenantsList({ landlordId: "landlord-1" });

    expect(first.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
    expect(second.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
    expect(second.filter((tenant) => tenant.applicationId === "app-1")).toHaveLength(1);
  });

  it("dedupes persisted duplicate tenant docs and prefers the canonical converted tenant", async () => {
    tenantDocs.clear();
    tenantDocs.set("invite-fallback-tenant", {
      landlordId: "landlord-1",
      fullName: "Invite Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: "app-1",
      source: "invite",
      createdAt: "2026-01-06T00:00:00.000Z",
    });
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({ landlordId: "landlord-1" });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
  });

  it("hydrates missing property name and unit label from canonical records", async () => {
    tenantDocs.clear();
    propertyDocs.set("property-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
    });
    unitDocs.set("unit-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitNumber: "302",
      label: "Suite 302",
    });
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      unit: "unit-1",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({ landlordId: "landlord-1" });

    expect(tenants[0]).toMatchObject({
      id: "converted-tenant-1",
      propertyName: "Harbour View",
      unit: "302",
      lifecycle: expect.objectContaining({
        lifecycleState: "active",
        lifecycleLabel: "Active",
      }),
    });
  });

  it("preserves fallback tenants when no tenant records exist outside landlord scope", async () => {
    tenantDocs.clear();

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList();

    expect(tenants.map((tenant) => tenant.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("getTenantDetailBundle", () => {
  beforeEach(() => {
    tenantDocs.clear();
    propertyDocs.clear();
    unitDocs.clear();
    leaseDocs.clear();
    signingRequestDocs.clear();
    canonicalEventDocs.clear();
    getSignedLeaseDocumentDownloadMock.mockReset();
    getSignedLeaseDocumentDownloadMock.mockResolvedValue({
      documentUrl: null,
      expiresInSeconds: null,
      documentHash: null,
      signedDocumentStoredAt: null,
      source: null,
    });
  });

  it("projects signed lease signing request state into tenant profile readiness and coherence", async () => {
    propertyDocs.set("property-1", {
      landlordId: "landlord-1",
      name: "Oxford Suites",
    });
    unitDocs.set("unit-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitNumber: "6",
      label: "Unit 6",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    tenantDocs.set("tenant-1", {
      landlordId: "landlord-1",
      fullName: "Signed Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      currentLeaseId: "lease-1",
      status: "Current",
      createdAt: "2026-01-05T00:00:00.000Z",
    });
    leaseDocs.set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      monthlyRent: 1800,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    signingRequestDocs.set("request-1", {
      leaseId: "lease-1",
      landlordId: "landlord-1",
      currentSigningStatus: "signed",
      currentStatusAt: "2026-06-10T12:00:00.000Z",
      providerDispatchStatus: "accepted",
      documentId: "doc-1",
      documentHash: "hash-1",
      manifestHash: "manifest-1",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-form-p-draft-v1",
    });
    getSignedLeaseDocumentDownloadMock.mockResolvedValue({
      documentUrl: "https://storage.googleapis.com/rentchain-documents-prod/lease-signing/1?X-Goog-Signature=safe",
      expiresInSeconds: 1800,
      documentHash: "hash-1",
      signedDocumentStoredAt: "2026-06-10T12:05:00.000Z",
      source: "signedDocument",
    });
    canonicalEventDocs.set("event-1", {
      action: "signing_signed",
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-06-10T12:00:00.000Z",
    });

    const { getTenantDetailBundle } = await import("../tenantDetailsService");
    const bundle = await getTenantDetailBundle("tenant-1", { landlordId: "landlord-1" });

    expect(bundle.currentLease).toEqual(
      expect.objectContaining({
        id: "lease-1",
        status: "active",
        unit: "6",
        signedDocumentUrl:
          "https://storage.googleapis.com/rentchain-documents-prod/lease-signing/1?X-Goog-Signature=safe",
        signedDocumentExpiresInSeconds: 1800,
        signedDocumentSource: "signedDocument",
      })
    );
    expect(getSignedLeaseDocumentDownloadMock).toHaveBeenCalledWith({
      leaseId: "lease-1",
      landlordId: "landlord-1",
    });
    expect(bundle.lifecycle).toEqual(
      expect.objectContaining({
        lifecycleState: "active",
        flags: expect.objectContaining({ hasStateConflict: false }),
      })
    );
    expect(bundle.stateCoherence).toEqual(
      expect.objectContaining({
        coherenceStatus: "coherent",
        leaseExecutionState: "executed",
        leaseOperationalState: "active",
        occupancyState: "occupied",
      })
    );
    expect(bundle.moveInRequirements?.items.find((item) => item.key === "lease_signed")).toEqual(
      expect.objectContaining({
        state: "complete",
        source: "signing_request",
        note: null,
      })
    );
  });

  it("falls back to internal lease summary when no signed document source is available", async () => {
    tenantDocs.set("tenant-1", {
      landlordId: "landlord-1",
      fullName: "Unsigned Tenant",
      propertyId: "property-1",
      unitId: "unit-1",
      currentLeaseId: "lease-1",
      status: "Current",
    });
    propertyDocs.set("property-1", { landlordId: "landlord-1", name: "Oxford Suites" });
    unitDocs.set("unit-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitNumber: "6",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    leaseDocs.set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      status: "pending_signature",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      monthlyRent: 1800,
    });

    const { getTenantDetailBundle } = await import("../tenantDetailsService");
    const bundle = await getTenantDetailBundle("tenant-1", { landlordId: "landlord-1" });

    expect(bundle.currentLease).toEqual(
      expect.objectContaining({
        id: "lease-1",
        signedDocumentUrl: null,
        signedDocumentExpiresInSeconds: null,
        signedDocumentSource: null,
      })
    );
    expect(getSignedLeaseDocumentDownloadMock).toHaveBeenCalledWith({
      leaseId: "lease-1",
      landlordId: "landlord-1",
    });
  });
});
