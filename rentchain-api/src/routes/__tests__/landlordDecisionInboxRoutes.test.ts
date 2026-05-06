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

const loadLandlordAnalyticsSnapshot = vi.fn();
let mockUser: any;

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../services/landlord/landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
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

function analyticsDecision(overrides: Record<string, any> = {}) {
  return {
    id: "approve_maintenance_cost:wo-1",
    decisionType: "approve_maintenance_cost",
    priority: "high",
    explanation: "A maintenance cost needs review.",
    supportingSignals: [],
    recommendedAction: "Open cost approval",
    state: "pending",
    actionLabel: "Open cost approval",
    destination: "/work-orders?workOrderId=wo-1",
    automationEligible: true,
    executionState: "executable",
    executionMapping: {
      resourceType: "work_order",
      resourceId: "wo-1",
    },
    ...overrides,
  };
}

function seedLease(overrides: Record<string, any> = {}) {
  seedDoc("leases", overrides.id || "lease-1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    monthlyRent: 1800,
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    dueDate: "2026-04-01",
    signedAt: "2026-04-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  });
}

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

describe("landlordDecisionInboxRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [analyticsDecision()] } });
  });

  it("returns read-only normalized decision inbox items and summary counts", async () => {
    seedLease();
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "approve_maintenance_cost:wo-1",
          source: "analytics",
          type: "maintenance",
          severity: "high",
          automationEligible: false,
          workflow: expect.objectContaining({
            queue: "maintenance_review",
            workflowState: "escalated",
            escalationLevel: "urgent",
            manualOnly: true,
          }),
        }),
        expect.objectContaining({
          source: "lease_ledger",
          type: "billing",
          severity: "critical",
          destination: "/leases/lease-1/ledger",
          automationEligible: false,
          workflow: expect.objectContaining({
            queue: "delinquency_review",
            workflowState: "escalated",
            escalationLevel: "critical",
            manualOnly: true,
          }),
          delinquencyActions: expect.arrayContaining([
            expect.objectContaining({ actionKey: "view_ledger", status: "available", manualOnly: true }),
            expect.objectContaining({ actionKey: "prepare_notice", status: "blocked", manualOnly: true }),
          ]),
        }),
      ])
    );
    expect(res.body.summary).toEqual(expect.objectContaining({ total: 3, critical: 2, high: 1, open: 3 }));
    expect(res.body.workflowSummary).toEqual(expect.objectContaining({ escalated: 3, critical: 2 }));
  });

  it("filters inbox items by severity, status, type, and workflow routing", async () => {
    seedLease();
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/decision-inbox?severity=critical&status=open&type=billing&queue=delinquency_review&workflowState=escalated&escalationLevel=critical",
    });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "lease_ledger", type: "billing" }),
      ])
    );
  });

  it("does not expose another landlord's lease decisions", async () => {
    seedLease({ id: "lease-other", landlordId: "landlord-2" });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("blocks non-landlord users", async () => {
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/decision-inbox",
      user: { id: "tenant-1", role: "tenant" },
    });

    expect(res.status).toBe(403);
  });
});
