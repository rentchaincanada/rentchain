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

vi.mock("../../firebase", () => ({
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
          automatedWorkflow: expect.objectContaining({
            workflowType: "maintenance",
            status: "pending",
            manualReviewRequired: true,
            externalExecutionEnabled: false,
            policyGuarded: true,
          }),
          agentActions: expect.arrayContaining([
            expect.objectContaining({
              actionType: "suggest_escalation",
              status: "suggested",
              manualReviewRequired: true,
              policyGuarded: true,
              externalExecutionEnabled: false,
              requiresHumanApproval: true,
            }),
          ]),
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
          automatedWorkflow: expect.objectContaining({
            workflowType: "delinquency",
            status: "pending",
            manualReviewRequired: true,
            externalExecutionEnabled: false,
            canonicalEvents: expect.arrayContaining([
              expect.objectContaining({ eventType: "automated_workflow_escalation_flagged" }),
              expect.objectContaining({ eventType: "automated_workflow_review_required" }),
            ]),
          }),
          agentActions: expect.arrayContaining([
            expect.objectContaining({
              actionType: "suggest_escalation",
              status: "suggested",
              canonicalEvents: expect.arrayContaining([
                expect.objectContaining({ eventType: "policy_gated_agent_action_review_required" }),
              ]),
            }),
          ]),
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
    expect(res.body.automationSummary).toEqual(expect.objectContaining({
      total: 3,
      pending: 3,
      escalationFlagged: 3,
      reviewRequired: 3,
    }));
    expect(res.body.agentActionSummary).toEqual(expect.objectContaining({
      total: 3,
      suggested: 3,
      reviewRequired: 3,
      escalationSuggested: 3,
    }));
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

  it("does not emit active missing-payment decisions when canonical payment evidence covers the lease obligation", async () => {
    seedLease();
    seedDoc("payments", "payment-canonical-overpaid", {
      leaseId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      amountCents: 220000,
      currency: "cad",
      status: "recorded",
      effectiveDate: "2026-04-01",
      source: "imported_bank_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("does not emit active missing-payment decisions when ledger-entry payment evidence covers the lease obligation", async () => {
    seedLease();
    seedDoc("ledgerEntries", "ledger-payment-overpaid", {
      leaseId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      amountCents: -220000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("suppresses stale analytics missing-payment decisions when current lease ledger evidence is settled", async () => {
    seedLease();
    seedDoc("ledgerEntries", "ledger-payment-settled", {
      leaseId: "lease-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      amountCents: 220000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:lease-1",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/lease-1/ledger",
            executionMapping: { resourceType: "lease", resourceId: "lease-1" },
          }),
        ],
      },
    });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("suppresses stale analytics missing-payment decisions when the ledger destination uses a persisted lease alias", async () => {
    seedDoc("leases", "lease-doc-1", {
      leaseId: "lease-public-1",
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
    });
    seedDoc("ledgerEntries", "ledger-payment-alias-settled", {
      leaseId: "lease-public-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      amountCents: 220000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:lease-public-1",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/lease-public-1/ledger",
            executionMapping: { resourceType: "lease", resourceId: "lease-public-1" },
          }),
        ],
      },
    });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("suppresses stale analytics missing-payment decisions when the related lease id is stale but the ledger destination is settled", async () => {
    seedLease({ id: "76c2961b-eae5-4574-9f51-66096976b5dc", monthlyRent: 1500 });
    seedDoc("ledgerEntries", "ledger-payment-settled-route-id", {
      leaseId: "76c2961b-eae5-4574-9f51-66096976b5dc",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      amountCents: 150000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:internal-source-lease-id",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/76c2961b-eae5-4574-9f51-66096976b5dc/ledger",
            executionMapping: { resourceType: "lease", resourceId: "internal-source-lease-id" },
          }),
        ],
      },
    });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("suppresses stale analytics missing-payment decisions for an overpaid up-to-date lease", async () => {
    seedLease({ id: "bd89a684-7e0a-439e-9b88-29d11de1bcfe", monthlyRent: 1500 });
    seedDoc("payments", "payment-canonical-overpaid-bd89", {
      leaseId: "bd89a684-7e0a-439e-9b88-29d11de1bcfe",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      amountCents: 180000,
      currency: "cad",
      status: "reconciled",
      effectiveDate: "2026-04-01",
      source: "imported_bank_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:bd89a684-7e0a-439e-9b88-29d11de1bcfe",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/bd89a684-7e0a-439e-9b88-29d11de1bcfe/ledger",
            executionMapping: { resourceType: "lease", resourceId: "bd89a684-7e0a-439e-9b88-29d11de1bcfe" },
          }),
        ],
      },
    });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain("bd89a684-7e0a-439e-9b88-29d11de1bcfe");
    expect(JSON.stringify(res.body)).not.toContain("Review Missing Payment");
  });

  it("suppresses analytics missing-payment decisions that cannot be validated by a live unsettled lease obligation", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:missing-source-lease",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/missing-source-lease/ledger",
            executionMapping: { resourceType: "lease", resourceId: "missing-source-lease" },
          }),
        ],
      },
    });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("preserves genuine missing-payment decisions when no payment evidence covers the lease obligation", async () => {
    seedLease();
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "lease_ledger",
          type: "billing",
          title: "Review Missing Payment",
          destination: "/leases/lease-1/ledger",
          dueAt: "2026-04-01T00:00:00.000Z",
          description: expect.stringContaining("outstanding $1,800.00"),
        }),
      ])
    );
  });

  it("preserves genuine overdue missing-payment decisions with safe obligation context", async () => {
    seedLease({
      id: "y7XM6BFXIzWW0fV3mu1L",
      monthlyRent: 2000,
      dueDate: "2026-04-01",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "lease_ledger",
          type: "billing",
          title: "Review Missing Payment",
          destination: "/leases/y7XM6BFXIzWW0fV3mu1L/ledger",
          dueAt: "2026-04-01T00:00:00.000Z",
          description: expect.stringContaining("Expected $2,000.00"),
        }),
      ])
    );
  });

  it("labels aggregate credit plus outstanding obligations as payment allocation review", async () => {
    seedLease({
      id: "y7XM6BFXIzWW0fV3mu1L",
      monthlyRent: 2000,
      dueDate: "2026-04-01",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
    seedDoc("ledgerEntries", "ledger-credit-adjustment", {
      leaseId: "y7XM6BFXIzWW0fV3mu1L",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "adjustment",
      amountCents: -876900,
      effectiveDate: "2026-05-31",
      source: "manual_credit_adjustment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "lease_ledger",
          type: "billing",
          title: "Review payment allocation",
          destination: "/leases/y7XM6BFXIzWW0fV3mu1L/ledger",
          dueAt: "2026-04-01T00:00:00.000Z",
          description: "Lease has an aggregate credit balance of -$8,769.00, but $2,000.00 remains outstanding on specific obligations. Review payment allocation before taking overdue-rent action.",
        }),
      ])
    );
    expect(res.body.items.map((item: any) => item.title)).not.toContain("Review Overdue Rent");
    expect(res.body.items.map((item: any) => item.title)).not.toContain("Review Missing Payment");
    expect(JSON.stringify(res.body)).not.toContain("tenant owes");
  });

  it("does not emit overdue payment actions for neutral settled ledger balances", async () => {
    seedLease({
      id: "lease-neutral",
      monthlyRent: 2000,
      dueDate: "2026-04-01",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
    seedDoc("ledgerEntries", "ledger-neutral-charge", {
      leaseId: "lease-neutral",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "charge",
      amountCents: 200000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_charge",
    });
    seedDoc("ledgerEntries", "ledger-neutral-payment", {
      leaseId: "lease-neutral",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      entryType: "payment",
      amountCents: 200000,
      effectiveDate: "2026-04-01",
      source: "manual_ledger_payment",
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-inbox?type=billing" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.summary.total).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain("Review Overdue Rent");
    expect(JSON.stringify(res.body)).not.toContain("Review payment allocation");
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

  it("returns read-only automated workflow previews without invoking execution behavior", async () => {
    seedLease();
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/automated-workflows/preview?workflowType=delinquency&status=pending&queue=delinquency_review",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.manualReviewRequired).toBe(true);
    expect(res.body.externalExecutionEnabled).toBe(false);
    expect(res.body.workflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowType: "delinquency",
          queue: "delinquency_review",
          status: "pending",
          manualReviewRequired: true,
          externalExecutionEnabled: false,
          requiresHumanAcknowledgement: true,
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({ eventType: "automated_workflow_review_required" }),
          ]),
        }),
      ])
    );
    expect(JSON.stringify(res.body)).not.toMatch(/externalExecutionEnabled":true|executed":true|charge tenant|file eviction/i);
  });

  it("returns read-only policy-gated agent action suggestions", async () => {
    seedLease();
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/agent-actions/suggestions?actionType=suggest_escalation&status=suggested&queue=delinquency_review",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.manualReviewRequired).toBe(true);
    expect(res.body.externalExecutionEnabled).toBe(false);
    expect(res.body.requiresHumanApproval).toBe(true);
    expect(res.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "suggest_escalation",
          status: "suggested",
          manualReviewRequired: true,
          policyGuarded: true,
          externalExecutionEnabled: false,
          requiresHumanApproval: true,
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({ eventType: "policy_gated_agent_action_suggested" }),
            expect.objectContaining({ eventType: "policy_gated_agent_action_review_required" }),
          ]),
        }),
      ])
    );
    expect(JSON.stringify(res.body)).not.toMatch(/externalExecutionEnabled":true|executed":true|charge tenant|file eviction/i);
  });

  it("returns a read-only agent supervision snapshot without execution behavior", async () => {
    seedLease();
    const router = (await import("../landlordDecisionInboxRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/agent-supervision/snapshot?queue=delinquency_review&escalationLevel=critical",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.manualReviewRequired).toBe(true);
    expect(res.body.externalExecutionEnabled).toBe(false);
    expect(res.body.autonomousExecutionEnabled).toBe(false);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        suggestedActions: 2,
        blockedActions: 0,
        escalations: 2,
      })
    );
    expect(res.body.agentActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "agent_action",
          status: "suggested",
          policyGuarded: true,
          manualReviewRequired: true,
          requiresHumanApproval: true,
        }),
      ])
    );
    expect(res.body.workflowStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "pending_review",
          relatedScope: expect.objectContaining({ scope: "workflow" }),
        }),
      ])
    );
    expect(res.body.canonicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "agent_supervision_snapshot_generated" }),
        expect.objectContaining({ eventType: "agent_supervision_escalation_visible" }),
      ])
    );
    expect(JSON.stringify(res.body)).not.toMatch(/externalExecutionEnabled":true|autonomousExecutionEnabled":true|executed":true|charge tenant|file eviction/i);
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
