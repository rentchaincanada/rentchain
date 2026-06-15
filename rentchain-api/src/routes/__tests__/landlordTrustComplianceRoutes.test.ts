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
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../lib/events/buildEvent", () => ({
  CANONICAL_EVENTS_COLLECTION: "canonicalEvents",
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

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      body: {},
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
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("landlordTrustComplianceRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    writeCanonicalEventMock.mockClear();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockUser = null;
    const router = (await import("../landlordTrustComplianceRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/trust-compliance/summary", user: null });

    expect(res.status).toBe(401);
    expect(res.headers["x-trust-compliance-route-version"]).toBe("trust-compliance-center-v1");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-landlord users", async () => {
    mockUser = { id: "tenant-1", role: "tenant" };
    const router = (await import("../landlordTrustComplianceRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/trust-compliance/summary" });

    expect(res.status).toBe(403);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("returns a landlord-scoped read-only trust compliance summary", async () => {
    seedDoc("canonicalEvents", "evidence-1", {
      type: "lease.evidence_package_generated",
      action: "evidence_package_generated",
      actor: { id: "landlord-1", role: "landlord" },
      occurredAt: "2026-06-14T10:00:00.000Z",
      summary: "Lease evidence package PDF generated",
      metadata: {
        landlordId: "landlord-1",
        evidencePackageId: "lep_safe",
        manifestHash: "a".repeat(64),
        manifestVersion: "lease_evidence_manifest_v1",
        packageVersion: "lease-evidence-package-pdf-v1",
        documentUrl: "gs://private/raw.pdf",
      },
    });
    seedDoc("canonicalEvents", "export-1", {
      type: "lease.institutional_export_generated",
      action: "institutional_export_generated",
      actor: { id: "landlord-1", role: "landlord" },
      occurredAt: "2026-06-14T11:00:00.000Z",
      summary: "Lease institutional evidence export generated",
      metadata: {
        exportReason: "tribunal",
        exportScope: "lease_evidence_package",
        exportFormat: "pdf",
        retentionCategory: "export_metadata",
        sensitivity: "confidential",
        paymentProcessorId: "pi_secret_123",
      },
    });
    seedDoc("canonicalEvents", "other-1", {
      type: "lease.institutional_export_generated",
      action: "institutional_export_generated",
      actor: { id: "landlord-2", role: "landlord" },
      occurredAt: "2026-06-14T12:00:00.000Z",
      summary: "Other landlord export",
      metadata: { landlordId: "landlord-2" },
    });
    seedDoc("consents", "consent-1", {
      landlordId: "landlord-1",
      status: "active",
      consentType: "screening_consent",
      signedDocumentStoragePath: "gs://private/consent.pdf",
      createdAt: "2026-06-13T09:00:00.000Z",
    });
    seedDoc("screeningOrders", "screening-1", {
      landlordId: "landlord-1",
      status: "paid",
      rawBureauPayload: "secret bureau data",
      createdAt: "2026-06-12T09:00:00.000Z",
    });

    const router = (await import("../landlordTrustComplianceRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/trust-compliance/summary" });

    expect(res.status).toBe(200);
    expect(res.headers["x-trust-compliance-route-version"]).toBe("trust-compliance-center-v1");
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        version: "trust_compliance_center_v1",
        landlordId: "landlord-1",
        overallStatus: expect.any(String),
      })
    );
    const evidence = res.body.summary.sections.find((section: any) => section.key === "evidence_exports");
    expect(evidence.count).toBe(2);
    expect(evidence.lastActivityAt).toBe("2026-06-14T11:00:00.000Z");
    expect(evidence.items[0].safeMetadata).toEqual(
      expect.objectContaining({
        exportReason: "tribunal",
        exportScope: "lease_evidence_package",
        exportFormat: "pdf",
        retentionCategory: "export_metadata",
      })
    );
    expect(res.body.summary.sections.map((section: any) => section.key)).toEqual([
      "evidence_exports",
      "consent",
      "privacy",
      "retention",
      "screening",
      "audit_trail",
      "incident_readiness",
    ]);
    expect(res.body.summary.recentAuditTrail.length).toBeLessThanOrEqual(12);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();

    const serialized = JSON.stringify(res.body.summary);
    expect(serialized).not.toContain("other-1");
    expect(serialized).not.toContain("landlord-2");
    expect(serialized).not.toContain("gs://private");
    expect(serialized).not.toContain("pi_secret_123");
    expect(serialized).not.toContain("secret bureau data");
    expect(serialized).not.toContain("rawBureauPayload");
    expect(serialized).not.toContain("documentUrl");
  });
});
