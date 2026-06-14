import { beforeEach, describe, expect, it, vi } from "vitest";

const writeCanonicalEventMock = vi.hoisted(() => vi.fn(async () => ({ id: "event-1" })));

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  const clone = (value: any) => JSON.parse(JSON.stringify(value));
  const getPath = (value: any, path: string) =>
    path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), value);
  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = getPath(doc?.data, field);
      if (op === "==") return actual === value;
      return false;
    });
  }
  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = [], cap = Infinity): any {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }], cap),
      limit: (limit: number) => makeQuery(name, filters, limit),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .slice(0, cap)
          .map((doc) => ({ id: doc.id, exists: true, data: () => clone(doc.data) }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id: string) => makeDoc(name, id),
    };
  }
  function makeDoc(name: string, id: string) {
    const col = ensureCollection(name);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => clone(entry?.data) };
      },
      set: async (data: any) => {
        col.set(id, { id, data: clone(data) });
      },
    };
  }
  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data: clone(data) }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        limit: (limit: number) => makeQuery(name, [], limit),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: writeCanonicalEventMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user.landlordId = landlordId;
    return next();
  },
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; body?: Record<string, unknown>; user?: Record<string, unknown> | null }
) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string>; text: string; buffer: Buffer }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      body: options.body || {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers, text: JSON.stringify(payload), buffer: Buffer.from("") });
        return this;
      },
      send(payload: any) {
        const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
        resolve({ status: this.statusCode, body: null, headers: this.headers, text: buffer.toString("latin1"), buffer });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedLease(overrides: Record<string, any> = {}) {
  seedDoc("leases", "lease-1", {
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    tenantName: "Jane Tenant",
    propertyName: "Oxford Suites",
    unitNumber: "101",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRent: 1800,
    documentUrl: "gs://private-bucket/raw-lease.pdf",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    exportFormat: "pdf",
    exportReason: "tribunal",
    exportScope: "lease_evidence_package",
    resourceType: "lease",
    leaseId: "lease-1",
    ...overrides,
  };
}

function decodedPdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const chunks: string[] = [];
  for (const match of raw.matchAll(/<([0-9a-fA-F]+)>/g)) {
    chunks.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return chunks.join("");
}

describe("landlordInstitutionalExportGenerationRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    writeCanonicalEventMock.mockClear();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("lets a landlord generate a PDF institutional export for their own lease", async () => {
    seedLease();
    seedDoc("payments", "payment-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      amount: 1800,
      method: "etransfer",
      paidAt: "2026-02-01T00:00:00.000Z",
      processorPaymentIntentId: "pi_secret_123",
    });
    seedDoc("leaseSigningRequests", "signing-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      providerRequestId: "provider_secret_request_123",
      providerDispatchStatus: "sent",
      sentAt: "2026-02-02T00:00:00.000Z",
    });
    seedDoc("canonicalEvents", "event-1", {
      type: "lease.created",
      action: "created",
      resource: { id: "lease-1", type: "lease" },
      summary: "Lease created.",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });

    const router = (await import("../landlordInstitutionalExportGenerationRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/institutional-exports", body: validBody() });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/rentchain-institutional-lease-evidence-export-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(res.headers["x-rentchain-governance"]).toBe("metadata-only");
    expect(res.headers["x-rentchain-export-sensitivity"]).toBe("confidential");
    expect(res.headers["x-rentchain-retention-category"]).toBe("export_metadata");
    expect(res.headers["x-rentchain-institutional-export-id"]).toMatch(/^instexp_[a-f0-9]{24}$/);
    expect(res.headers["x-rentchain-institutional-export-version"]).toBe("institutional-export-framework-v1");
    expect(res.headers["x-rentchain-evidence-package-id"]).toMatch(/^lep_[a-f0-9]{24}$/);
    expect(res.buffer.toString("latin1", 0, 5)).toBe("%PDF-");

    expect(writeCanonicalEventMock).toHaveBeenCalledTimes(1);
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "lease",
        action: "institutional_export_generated",
        resource: { type: "lease", id: "lease-1" },
        metadata: expect.objectContaining({
          exportId: res.headers["x-rentchain-institutional-export-id"],
          exportType: "institutional_export",
          exportFormat: "pdf",
          exportReason: "tribunal",
          exportScope: "lease_evidence_package",
          resourceType: "lease",
          resourceId: "lease-1",
          leaseId: "lease-1",
          generatedBy: "landlord-1",
          generatedAt: expect.any(String),
          evidencePackageId: res.headers["x-rentchain-evidence-package-id"],
          manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          manifestVersion: "lease_evidence_manifest_v1",
          packageVersion: "lease-evidence-package-pdf-v1",
        }),
      })
    );

    const pdfText = decodedPdfText(res.buffer);
    expect(pdfText).toContain("Generated By");
    expect(pdfText).toContain("Authorized User");
    expect(pdfText).toContain("Verification Summary");
    expect(pdfText).toContain("Manifest Hash");
    for (const unsafe of [
      "landlord-1",
      "gs://private-bucket/raw-lease.pdf",
      "pi_secret_123",
      "provider_secret_request_123",
      "payments:",
      "leaseSigningRequests:",
      "canonicalEvents:",
      "sourceReference",
    ]) {
      expect(pdfText).not.toContain(unsafe);
    }
    for (const unsafe of [
      "gs://private-bucket/raw-lease.pdf",
      "pi_secret_123",
      "provider_secret_request_123",
      "payments:",
      "leaseSigningRequests:",
      "canonicalEvents:",
      "sourceReference",
    ]) {
      expect(JSON.stringify(writeCanonicalEventMock.mock.calls[0][0].metadata)).not.toContain(unsafe);
    }
  });

  it("returns 403 for another landlord and writes no success event", async () => {
    seedLease();
    mockUser = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
    const router = (await import("../landlordInstitutionalExportGenerationRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/institutional-exports", body: validBody() });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing lease and writes no success event", async () => {
    const router = (await import("../landlordInstitutionalExportGenerationRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/institutional-exports", body: validBody() });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("LEASE_NOT_FOUND");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ exportFormat: "csv" }, "UNSUPPORTED_EXPORT_FORMAT"],
    [{ exportScope: "payments" }, "UNSUPPORTED_EXPORT_SCOPE"],
    [{ resourceType: "tenant" }, "UNSUPPORTED_EXPORT_RESOURCE"],
    [{ exportReason: "unsupported" }, "INVALID_EXPORT_REASON"],
  ])("rejects invalid export request %o and writes no success event", async (patch, errorCode) => {
    seedLease();
    const router = (await import("../landlordInstitutionalExportGenerationRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/institutional-exports",
      body: validBody(patch),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(errorCode);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });
});
