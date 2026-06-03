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
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({ db: fakeDb }));

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
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: mockUser,
      body: {},
      query: Object.fromEntries(new URLSearchParams(queryString || "").entries()),
      params: {},
      headers: {},
    };
    const match = path.match(/^\/rental-debt\/(.+)$/);
    if (match) req.params = { rentalDebtId: decodeURIComponent(match[1]) };
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
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

describe("landlordRentalDebtRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
  });

  function seedRentalDebt() {
    seedDoc("ledgerEvents", "ledger-default-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      ledgerEventId: "ledger-default-1",
      status: "past_due",
      paymentAccount: "hidden",
    });
    seedDoc("rentPayments", "payment-default-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      rentPaymentId: "payment-default-1",
      paymentStatus: "overdue",
      rawPaymentPayload: "hidden",
    });
    seedDoc("delinquencyRecords", "delinquency-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      delinquencyId: "delinquency-1",
      status: "verified",
      unrestrictedDelinquencyHistory: "hidden",
    });
    seedDoc("disputeResolutionReadiness", "dispute-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      disputeId: "dispute-1",
      status: "verified",
      rawDisputePayload: "hidden",
    });
    seedDoc("consents", "consent-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      consentId: "consent-1",
      status: "verified",
      privateTenantData: "hidden",
    });
    seedDoc("operatorReviewSessions", "review-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      reviewSessionId: "review-1",
      status: "completed",
      privateNote: "hidden",
    });
    seedDoc("evidencePacks", "evidence-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      evidencePackId: "evidence-1",
      status: "verified",
      creditBureauPayload: "hidden",
    });
    seedDoc("events", "event-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      eventId: "event-1",
      eventType: "rental_debt_profile_derived",
      adminOnlyPayload: "hidden",
    });
    seedDoc("ledgerEvents", "other-default", {
      landlordId: "landlord-2",
      tenantId: "tenant-2",
      ledgerEventId: "other-default",
      status: "past_due",
    });
  }

  it("returns landlord-scoped rental-debt profiles without sensitive payloads", async () => {
    seedRentalDebt();
    const router = (await import("../landlordRentalDebtRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/rental-debt",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/rental-debt?tenantId=tenant-1",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(1);
    expect(res.body.profiles[0]).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        manualReviewRequired: true,
        collectionsExecutionEnabled: false,
        bureauReportingEnabled: false,
        publicDebtExposureEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("tenant-2");
    expect(serialized).not.toContain("paymentAccount");
    expect(serialized).not.toContain("rawPaymentPayload");
    expect(serialized).not.toContain("unrestrictedDelinquencyHistory");
    expect(serialized).not.toContain("rawDisputePayload");
    expect(serialized).not.toContain("privateTenantData");
    expect(serialized).not.toContain("privateNote");
    expect(serialized).not.toContain("creditBureauPayload");
    expect(serialized).not.toContain("adminOnlyPayload");
  });

  it("returns a single rental-debt profile by id", async () => {
    seedRentalDebt();
    const router = (await import("../landlordRentalDebtRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/rental-debt?tenantId=tenant-1" });
    const id = list.body.profiles[0].rentalDebtId;

    const res = await invokeRouter(router, { method: "GET", url: `/rental-debt/${encodeURIComponent(id)}` });

    expect(res.status).toBe(200);
    expect(res.body.profile.rentalDebtId).toBe(id);
  });

  it("filters by status", async () => {
    seedRentalDebt();
    const router = (await import("../landlordRentalDebtRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/rental-debt?status=blocked" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.profiles).toEqual([]);
  });
});
