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
    const match = path.match(/^\/rental-history-ledger\/(.+)$/);
    if (match) req.params = { ledgerId: decodeURIComponent(match[1]) };
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

describe("landlordRentalHistoryLedgerRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  function seedRentalHistory() {
    seedDoc("tenants", "tenant-1", {
      landlordId: "landlord-1",
      screeningId: "screening-1",
      governmentIdRaw: "sensitive-government-id",
      paymentAccount: "sensitive-payment-account",
    });
    seedDoc("tenants", "tenant-other", { landlordId: "landlord-2", screeningId: "screening-other" });
    seedDoc("leases", "lease-1", { landlordId: "landlord-1", tenantId: "tenant-1", propertyId: "property-1", startDate: "2025-01-01" });
    seedDoc("properties", "property-1", { landlordId: "landlord-1", addressLine1: "123 Main St" });
    seedDoc("maintenanceRequests", "maintenance-1", { landlordId: "landlord-1", tenantId: "tenant-1", leaseId: "lease-1" });
    seedDoc("operatorReviewSessions", "review-1", { landlordId: "landlord-1", reviewSessionId: "review-1", scopeId: "lease-1" });
    seedDoc("evidencePacks", "evidence-1", { landlordId: "landlord-1", evidencePackId: "evidence-1", scopeId: "lease-1" });
    seedDoc("landlordAnalyticsSnapshots", "analytics-1", {
      landlordId: "landlord-1",
      decisions: {
        items: [
          {
            id: "decision-1",
            decisionType: "overdue_rent",
            priority: "high",
            tenantId: "tenant-1",
            executionMapping: { resourceType: "lease", resourceId: "lease-1" },
          },
        ],
      },
    });
    seedDoc("consents", "consent-1", { landlordId: "landlord-1", tenantId: "tenant-1", scope: "rental history portability consent" });
    seedDoc("events", "event-1", { landlordId: "landlord-1", leaseId: "lease-1", type: "lease.created" });
  }

  it("returns landlord-scoped rental-history ledgers without sensitive raw payloads", async () => {
    seedRentalHistory();
    const router = (await import("../landlordRentalHistoryLedgerRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/rental-history-ledger?identityId=tenant-1" });

    expect(res.status).toBe(200);
    expect(res.body.ledgers).toHaveLength(1);
    expect(res.body.ledgers[0]).toEqual(
      expect.objectContaining({
        identityId: "tenant:tenant-1",
        manualReviewRequired: true,
        publiclyShareable: false,
        externalInstitutionSharingEnabled: false,
        tokenizationEnabled: false,
      })
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("sensitive-government-id");
    expect(serialized).not.toContain("sensitive-payment-account");
    expect(serialized).not.toContain("tenant-other");
  });

  it("returns a single ledger by ledger id", async () => {
    seedRentalHistory();
    const router = (await import("../landlordRentalHistoryLedgerRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/rental-history-ledger/verified_rental_history%3Atenant%3Atenant-1",
    });

    expect(res.status).toBe(200);
    expect(res.body.ledger.identityId).toBe("tenant:tenant-1");
    expect(res.body.ledger.historyEntries.map((entry: any) => entry.entryType)).toEqual(
      expect.arrayContaining(["lease_participation", "occupancy", "maintenance_history", "delinquency_review"])
    );
  });

  it("filters by status and blocks non-landlord users", async () => {
    seedRentalHistory();
    const router = (await import("../landlordRentalHistoryLedgerRoutes")).default;

    const filtered = await invokeRouter(router, { method: "GET", url: "/rental-history-ledger?status=blocked" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.ledgers).toEqual([]);

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/rental-history-ledger",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);
  });
});
