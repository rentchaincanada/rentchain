import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
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
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any) => {
        col.set(id, { id, data });
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
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
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
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
    const match = path.match(/^\/settlement-readiness\/(.+)$/);
    if (match) req.params = { settlementReadinessId: decodeURIComponent(match[1]) };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("landlordSettlementReadinessRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  function seedSettlementReadiness() {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      amountCents: 200000,
      currency: "cad",
    });
    seedDoc("paymentIntents", "pi-1", {
      landlordId: "landlord-1",
      paymentIntentId: "pi-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      amountCents: 200000,
      currency: "cad",
      status: "reconciled",
    });
    seedDoc("rentPayments", "rp-1", {
      landlordId: "landlord-1",
      id: "rp-1",
      paymentIntentId: "pi-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      amountCents: 200000,
      currency: "cad",
      status: "paid",
      rawBankAccount: "sensitive-bank",
    });
    seedDoc("paymentReconciliationRecords", "recon-1", {
      landlordId: "landlord-1",
      reconciliationId: "recon-1",
      provider: "stripe",
      providerEventId: "evt-1",
      idempotencyKey: "key-1",
      receiptId: "receipt-1",
      paymentIntentId: "pi-1",
      reconciliationStatus: "reconciled",
      reasons: [],
      requiresManualReview: false,
      automationEligible: false,
      rawProcessorPayload: "sensitive-processor-payload",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    seedDoc("evidencePacks", "evidence-1", { landlordId: "landlord-1", evidencePackId: "evidence-1", scopeId: "lease-1" });
    seedDoc("operatorReviewSessions", "review-1", { landlordId: "landlord-1", reviewSessionId: "review-1", scopeId: "lease-1", status: "completed" });
    seedDoc("events", "event-1", { landlordId: "landlord-1", leaseId: "lease-1", type: "rent.payment.reconciled" });
  }

  it("returns landlord-scoped settlement readiness without sensitive payment payloads", async () => {
    seedSettlementReadiness();
    const router = (await import("../landlordSettlementReadinessRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/settlement-readiness?leaseId=lease-1" });

    expect(res.status).toBe(200);
    expect(res.body.readiness).toHaveLength(1);
    expect(res.body.readiness[0]).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        paymentExecutionEnabled: false,
        bankingIntegrationEnabled: false,
        tokenizationEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("sensitive-bank");
    expect(serialized).not.toContain("sensitive-processor-payload");
  });

  it("returns a single settlement readiness record by id", async () => {
    seedSettlementReadiness();
    const router = (await import("../landlordSettlementReadinessRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/settlement-readiness" });
    const readinessId = list.body.readiness[0].settlementReadinessId;

    const res = await invokeRouter(router, {
      method: "GET",
      url: `/settlement-readiness/${encodeURIComponent(readinessId)}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.readiness.settlementReadinessId).toBe(readinessId);
    expect(res.body.readiness.ledgerReferences.length).toBeGreaterThan(0);
  });

  it("filters by status and blocks non-landlord users", async () => {
    seedSettlementReadiness();
    const router = (await import("../landlordSettlementReadinessRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/settlement-readiness?status=unknown" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.readiness).toEqual([]);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/settlement-readiness",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);
  });
});
