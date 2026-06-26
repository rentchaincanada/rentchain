import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.hoisted(() => vi.fn());
const deriveLeaseDecisionsForInbox = vi.hoisted(() => vi.fn());
const derivePaymentConsistentDecisionInbox = vi.hoisted(() => vi.fn());
const getUnifiedInbox = vi.hoisted(() => vi.fn());
const writeCanonicalEventMock = vi.hoisted(() => vi.fn());
let mockUser: any;

vi.mock("../../services/landlord/landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
}));

vi.mock("../landlordDecisionInboxRoutes", () => {
  return {
    deriveLeaseDecisionsForInbox,
    derivePaymentConsistentDecisionInbox,
  };
});

vi.mock("../../services/unifiedInbox", () => ({
  getUnifiedInbox,
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

function analyticsDecision(overrides: Record<string, any> = {}) {
  return {
    id: "payment-decision-1",
    decisionType: "review_revenue_pressure",
    priority: "high",
    explanation: "Payment review is required.",
    supportingSignals: [],
    recommendedAction: "Review ledger",
    actionLabel: "Review ledger",
    destination: "/leases/lease-1/ledger",
    state: "pending",
    executionState: "blocked",
    executionMapping: {
      resourceType: "lease",
      resourceId: "lease-1",
    },
    ...overrides,
  };
}

function unifiedInboxRecord(overrides: Record<string, any> = {}) {
  return {
    id: "tenant-message-1",
    sourceKind: "landlord.message",
    audienceRole: "landlord",
    title: "Tenant awaiting reply",
    body: "Tenant asked for a response.",
    priority: "high",
    status: "unread",
    occurredAt: "2026-06-18T10:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

describe("landlordDecisionQueueRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [analyticsDecision()] } });
    deriveLeaseDecisionsForInbox.mockResolvedValue([]);
    derivePaymentConsistentDecisionInbox.mockImplementation(async ({ analyticsDecisions, leaseDecisions }: any) => {
      const { deriveDecisionInbox } = await import("../../lib/decisions/deriveDecisionInbox");
      return deriveDecisionInbox({ analyticsDecisions, leaseDecisions });
    });
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [unifiedInboxRecord()],
      records: [unifiedInboxRecord()],
      total: 1,
      limit: 100,
      offset: 0,
    });
  });

  it("returns 401 for unauthenticated requests with route version header", async () => {
    mockUser = null;
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue", user: null });

    expect(res.status).toBe(401);
    expect(res.headers["x-landlord-decision-queue-route-version"]).toBe("landlord-decision-queue-api-v1");
    expect(loadLandlordAnalyticsSnapshot).not.toHaveBeenCalled();
  });

  it("returns 403 for non-landlord users", async () => {
    mockUser = { id: "tenant-1", role: "tenant" };
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue" });

    expect(res.status).toBe(403);
    expect(getUnifiedInbox).not.toHaveBeenCalled();
  });

  it("returns a landlord-scoped normalized decision queue", async () => {
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBe("landlord_decision_queue_v1");
    expect(res.body.landlordId).toBe("landlord-1");
    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        landlordId: "landlord-1",
      })
    );
    expect(getUnifiedInbox).toHaveBeenCalledWith({ role: "landlord", landlordId: "landlord-1" }, { limit: 100 });
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          landlordId: "landlord-1",
          sourceType: "decision_inbox",
          workspace: "payments",
          severity: "warning",
        }),
        expect.objectContaining({
          landlordId: "landlord-1",
          sourceType: "message_unread_priority",
          workspace: "tenant",
          severity: "warning",
        }),
      ])
    );
    expect(JSON.stringify(res.body)).not.toContain("providerRequestId");
    expect(JSON.stringify(res.body)).not.toContain("gs://");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("supports safe filters and preserves stable sorting from the normalized service", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "critical-payment",
            priority: "high",
            executionState: "blocked",
            destination: "/leases/lease-1/ledger",
          }),
          analyticsDecision({
            id: "lease-info",
            decisionType: "review_lease_renewals",
            priority: "low",
            destination: "/leases/lease-2/summary",
          }),
        ],
      },
    });
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [
        unifiedInboxRecord({ id: "message-1", priority: "high", occurredAt: "2026-06-18T10:00:00.000Z" }),
        unifiedInboxRecord({ id: "notice-1", sourceKind: "landlord.notice", priority: "normal", status: "unread" }),
      ],
      records: [],
      total: 2,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?severity=warning&workspace=tenant&limit=1" });

    expect(res.status).toBe(200);
    expect(res.body.filters).toEqual({
      severity: "warning",
      workspace: "tenant",
      status: null,
    });
    expect(res.body.total).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        sourceId: "message-1",
        sourceType: "message_unread_priority",
        sortKey: expect.any(String),
      }),
    ]);
  });

  it("ignores invalid filters safely and applies default limit", async () => {
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/decision-queue?severity=severe&workspace=../../admin&status=destroyed&limit=-5",
    });

    expect(res.status).toBe(200);
    expect(res.body.filters).toEqual({
      severity: null,
      workspace: null,
      status: null,
    });
    expect(res.body.limit).toBe(50);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("returns a clean empty queue response", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValue({ decisions: { items: [] } });
    deriveLeaseDecisionsForInbox.mockResolvedValue([]);
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [],
      records: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        version: "landlord_decision_queue_v1",
        landlordId: "landlord-1",
        items: [],
        total: 0,
        limit: 50,
        summary: {
          total: 0,
          critical: 0,
          warning: 0,
          needsReview: 0,
          upcoming: 0,
          informational: 0,
          open: 0,
          blocked: 0,
        },
      })
    );
  });

  it("does not reintroduce stale payment decisions suppressed by the settled-payment-aware inbox", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          analyticsDecision({
            id: "stale_missing_payment:76c2961b-eae5-4574-9f51-66096976b5dc",
            decisionType: "missing_payment",
            actionLabel: "Review Missing Payment",
            recommendedAction: "Review Missing Payment",
            destination: "/leases/76c2961b-eae5-4574-9f51-66096976b5dc/ledger",
            executionMapping: { resourceType: "lease", resourceId: "76c2961b-eae5-4574-9f51-66096976b5dc" },
          }),
        ],
      },
    });
    derivePaymentConsistentDecisionInbox.mockResolvedValue({
      items: [],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
      workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [],
      records: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?status=open_state&limit=6" });

    expect(res.status).toBe(200);
    expect(derivePaymentConsistentDecisionInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        landlordId: "landlord-1",
        analyticsDecisions: expect.arrayContaining([
          expect.objectContaining({ id: "stale_missing_payment:76c2961b-eae5-4574-9f51-66096976b5dc" }),
        ]),
      })
    );
    expect(res.body.items).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("Review Missing Payment");
    expect(JSON.stringify(res.body)).not.toContain("76c2961b-eae5-4574-9f51-66096976b5dc");
  });

  it("does not show overpaid up-to-date leases as dashboard missing-payment decisions after inbox suppression", async () => {
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
    derivePaymentConsistentDecisionInbox.mockResolvedValue({
      items: [],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
      workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [],
      records: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?status=open_state&limit=6" });

    expect(res.status).toBe(200);
    expect(derivePaymentConsistentDecisionInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        landlordId: "landlord-1",
        analyticsDecisions: expect.arrayContaining([
          expect.objectContaining({ id: "stale_missing_payment:bd89a684-7e0a-439e-9b88-29d11de1bcfe" }),
        ]),
      })
    );
    expect(res.body.items).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("Review Missing Payment");
    expect(JSON.stringify(res.body)).not.toContain("bd89a684-7e0a-439e-9b88-29d11de1bcfe");
  });

  it("returns dashboard payment decisions with due-date context when the settled-payment-aware inbox finds a genuine unpaid obligation", async () => {
    derivePaymentConsistentDecisionInbox.mockResolvedValue({
      items: [
        {
          id: "decision:review_missing_payment:y7XM6BFXIzWW0fV3mu1L",
          title: "Review Missing Payment",
          description: "Expected rent payment is missing. Due 2026-04-01; Expected $2,000.00; paid $0.00; outstanding $2,000.00.",
          severity: "critical",
          status: "open",
          type: "billing",
          source: "lease_ledger",
          relatedEntity: { kind: "lease", id: "y7XM6BFXIzWW0fV3mu1L", label: "Lease y7XM6BFXIzWW0fV3mu1L" },
          destination: "/leases/y7XM6BFXIzWW0fV3mu1L/ledger",
          automationEligible: false,
          dueAt: "2026-04-01T00:00:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          workflow: {
            queue: "delinquency_review",
            workflowState: "new",
            ownershipType: "landlord",
            reviewPriority: "critical",
            escalationLevel: "critical",
            manualOnly: true,
          },
        },
      ],
      filters: { severity: [], status: [], type: [], queue: [], workflowState: [], escalationLevel: [] },
      summary: { total: 1, critical: 1, high: 0, open: 1, blocked: 0 },
      workflowSummary: { new: 1, underReview: 0, escalated: 0, critical: 1 },
      automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
      agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
    });
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [],
      records: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?status=open_state&limit=6" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        title: "Review Missing Payment",
        workspace: "payments",
        recommendedActionHref: "/leases/y7XM6BFXIzWW0fV3mu1L/ledger",
        dueAt: "2026-04-01T00:00:00.000Z",
        description: expect.stringContaining("outstanding $2,000.00"),
      }),
    ]);
  });

  it("keeps messaging source types and excludes non-landlord inbox records", async () => {
    getUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [
        unifiedInboxRecord({ id: "tenant-message", sourceKind: "landlord.message", priority: "high" }),
        unifiedInboxRecord({ id: "notice-message", sourceKind: "landlord.notice", priority: "normal", status: "unread" }),
        unifiedInboxRecord({ id: "maintenance-message", sourceKind: "landlord.maintenance", priority: "high" }),
        unifiedInboxRecord({ id: "tenant-scope-message", sourceKind: "tenant.message", audienceRole: "tenant", priority: "high" }),
      ],
      records: [],
      total: 4,
      limit: 100,
      offset: 0,
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?open=true" });

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.sourceType)).toEqual(
      expect.arrayContaining([
        "decision_inbox",
        "message_unread_priority",
        "message_notice_relevance",
        "message_maintenance_follow_up",
      ])
    );
    expect(JSON.stringify(res.body)).not.toContain("tenant-scope-message");
  });
});
