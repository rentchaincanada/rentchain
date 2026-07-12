import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.hoisted(() => vi.fn());
const deriveLeaseDecisionsForInbox = vi.hoisted(() => vi.fn());
const derivePaymentConsistentDecisionInbox = vi.hoisted(() => vi.fn());
const getUnifiedInbox = vi.hoisted(() => vi.fn());
const writeCanonicalEventMock = vi.hoisted(() => vi.fn());
const { fakeDb, resetFakeDb, seedDoc, getDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.[field];
      if (op === "==") return actual === value;
      return false;
    });
  }

  function makeDoc(name: string, id?: string) {
    const docId = id || `${name}_${++autoId}`;
    return {
      id: docId,
      get: async () => ({
        id: docId,
        exists: ensureCollection(name).has(docId),
        data: () => ensureCollection(name).get(docId),
      }),
      set: async (value: any) => {
        ensureCollection(name).set(docId, value);
      },
    };
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => matches(data, filters))
          .map(([id, data]) => ({ id, exists: true, data: () => data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  return {
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
    resetFakeDb: () => collections.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, data),
    getDoc: (collection: string, id: string) => ensureCollection(collection).get(id),
  };
});
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

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null; body?: Record<string, unknown> }) {
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
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
    writeCanonicalEventMock.mockResolvedValue({ id: "canonical-event-1" });
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

  it("overlays persisted lifecycle state onto derived source items without replacing the source queue", async () => {
    seedDoc("landlordDecisionQueueItems", "persisted-message-review", {
      id: "persisted-message-review",
      landlordId: "landlord-1",
      sourceType: "message_unread_priority",
      sourceId: "tenant-message-1",
      workspace: "tenant",
      severity: "warning",
      title: "Tenant awaiting reply",
      description: "Tenant asked for a response.",
      recommendedActionLabel: "Open message",
      recommendedActionHref: "/messages",
      dueAt: "2026-07-20T00:00:00.000Z",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
      status: "deferred",
      assignment: {
        assignedToUserId: "manager-1",
        assignedToEmail: "manager@example.com",
        assignmentLabel: "Manager",
      },
      lastActionAt: "2026-07-11T00:00:00.000Z",
      lastActionBy: "manager-1",
      dedupeKey: "message_unread_priority:tenant:tenant-message-1",
      auditEventIds: ["event-1"],
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/decision-queue?workspace=tenant" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id: "persisted-message-review",
        sourceType: "message_unread_priority",
        sourceId: "tenant-message-1",
        status: "deferred",
        dueAt: "2026-07-20T00:00:00.000Z",
        assignment: expect.objectContaining({
          assignedToEmail: "manager@example.com",
        }),
        auditEventIds: ["event-1"],
      }),
    ]);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("creates a persisted landlord decision queue item and records canonical audit context", async () => {
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/decision-queue/items",
      body: {
        sourceType: "renewal_notice_send_review",
        sourceId: "lease-1:notice-review",
        workspace: "notices",
        severity: "needs_review",
        title: "Review renewal communication",
        description: "Confirm the tenant communication before future delivery is enabled.",
        recommendedActionLabel: "Open notice review",
        recommendedActionHref: "/leases/lease-1/workflows/notice",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        dueAt: "2026-07-18",
        assignedToEmail: "manager@example.com",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.item).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        sourceType: "renewal_notice_send_review",
        sourceId: "lease-1:notice-review",
        workspace: "notices",
        status: "open",
        leaseId: "lease-1",
        auditEventIds: ["canonical-event-1"],
      })
    );
    expect(getDoc("landlordDecisionQueueItems", res.body.item.id)).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        sourceType: "renewal_notice_send_review",
        auditEventIds: ["canonical-event-1"],
      })
    );
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "system",
        action: "landlord_decision_queue_item_created",
        resource: expect.objectContaining({
          type: "landlord_decision_queue_item",
          id: res.body.item.id,
          parentId: "landlord-1",
        }),
        metadata: expect.objectContaining({
          noSendBehavior: true,
          noTenantNotification: true,
          noNoticeServed: true,
          noLeaseLifecycleMutation: true,
        }),
      })
    );
  });

  it("reuses an existing source-matched approval decision instead of creating a duplicate", async () => {
    seedDoc("landlordDecisionQueueItems", "existing-send-approval", {
      id: "existing-send-approval",
      landlordId: "landlord-1",
      sourceType: "renewal_notice_send_review",
      sourceId: "lease:lease-1:renewal_notice_send_review",
      sourceRoute: "/leases/lease-1/workflows/notice",
      workspace: "notices",
      severity: "warning",
      title: "Renewal tenant communication ready for approval",
      description: "Saved renewal notice draft is ready for send approval review.",
      recommendedActionLabel: "Open notice review",
      recommendedActionHref: "/leases/lease-1/workflows/notice",
      dueAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      status: "open",
      leaseId: "lease-1",
      dedupeKey: "lease:lease-1:renewal_notice_send_review",
      auditEventIds: ["existing-audit-event"],
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/decision-queue/items",
      body: {
        sourceType: "renewal_notice_send_review",
        sourceId: "lease:lease-1:renewal_notice_send_review",
        sourceRoute: "/leases/lease-1/workflows/notice",
        workspace: "notices",
        severity: "warning",
        title: "Renewal tenant communication ready for approval",
        description: "Saved renewal notice draft is ready for send approval review.",
        recommendedActionLabel: "Open notice review",
        recommendedActionHref: "/leases/lease-1/workflows/notice",
        leaseId: "lease-1",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      item: expect.objectContaining({
        id: "existing-send-approval",
        sourceType: "renewal_notice_send_review",
        sourceId: "lease:lease-1:renewal_notice_send_review",
        auditEventIds: ["existing-audit-event"],
      }),
      auditEventId: null,
      created: false,
    });
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("updates lifecycle status and assignment without creating send or notice behavior", async () => {
    seedDoc("landlordDecisionQueueItems", "decision-item-1", {
      id: "decision-item-1",
      landlordId: "landlord-1",
      sourceType: "renewal_notice_send_review",
      sourceId: "lease-1:notice-review",
      workspace: "notices",
      severity: "needs_review",
      title: "Review renewal communication",
      description: "Confirm the tenant communication before future delivery is enabled.",
      recommendedActionLabel: "Open notice review",
      recommendedActionHref: "/leases/lease-1/workflows/notice",
      dueAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      status: "open",
      leaseId: "lease-1",
      dedupeKey: "renewal_notice_send_review:lease-1:notice-review",
      auditEventIds: [],
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/decision-queue/items/decision-item-1",
      body: {
        action: "assign",
        status: "in_review",
        assignedToUserId: "manager-1",
        assignedToEmail: "manager@example.com",
        assignmentLabel: "Manager",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.item).toEqual(
      expect.objectContaining({
        id: "decision-item-1",
        status: "in_review",
        assignment: expect.objectContaining({
          assignedToUserId: "manager-1",
          assignedToEmail: "manager@example.com",
        }),
        auditEventIds: ["canonical-event-1"],
      })
    );
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "landlord_decision_queue_item_assign",
        metadata: expect.objectContaining({
          noSendBehavior: true,
          noTenantNotification: true,
          noNoticeServed: true,
          noLeaseLifecycleMutation: true,
        }),
      })
    );
  });

  it("does not reveal or update another landlord decision queue item", async () => {
    seedDoc("landlordDecisionQueueItems", "other-landlord-item", {
      id: "other-landlord-item",
      landlordId: "landlord-2",
      sourceType: "renewal_notice_send_review",
      sourceId: "lease-2:notice-review",
      workspace: "notices",
      severity: "needs_review",
      title: "Other landlord item",
      description: "Should not be visible.",
      recommendedActionLabel: "Open",
      recommendedActionHref: "/leases/lease-2/workflows/notice",
      dueAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      status: "open",
      dedupeKey: "other-landlord-item",
      auditEventIds: [],
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/decision-queue/items/other-landlord-item",
      body: { action: "resolve" },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "decision_item_not_found" });
    expect(getDoc("landlordDecisionQueueItems", "other-landlord-item")?.status).toBe("open");
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("rejects invalid due dates without writing lifecycle state or audit events", async () => {
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/decision-queue/items",
      body: {
        sourceType: "renewal_notice_send_review",
        sourceId: "lease-1:notice-review",
        workspace: "notices",
        severity: "needs_review",
        title: "Review renewal communication",
        description: "Confirm the tenant communication before future delivery is enabled.",
        recommendedActionLabel: "Open notice review",
        recommendedActionHref: "/leases/lease-1/workflows/notice",
        dueAt: "not-a-date",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "due_at_invalid" });
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
      sourceType: null,
      sourceId: null,
      sourceRoute: null,
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

  it("filters persisted decision queue items by source context", async () => {
    seedDoc("landlordDecisionQueueItems", "send-approval-lease-1", {
      id: "send-approval-lease-1",
      landlordId: "landlord-1",
      sourceType: "renewal_notice_send_review",
      sourceId: "lease:lease-1:renewal_notice_send_review",
      sourceRoute: "/leases/lease-1/workflows/notice",
      workspace: "notices",
      severity: "warning",
      title: "Renewal tenant communication ready for approval",
      description: "Saved renewal notice draft is ready for send approval review.",
      recommendedActionLabel: "Open notice review",
      recommendedActionHref: "/leases/lease-1/workflows/notice",
      dueAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      status: "open",
      leaseId: "lease-1",
      dedupeKey: "lease:lease-1:renewal_notice_send_review",
      auditEventIds: [],
    });
    seedDoc("landlordDecisionQueueItems", "send-approval-lease-2", {
      id: "send-approval-lease-2",
      landlordId: "landlord-1",
      sourceType: "renewal_notice_send_review",
      sourceId: "lease:lease-2:renewal_notice_send_review",
      sourceRoute: "/leases/lease-2/workflows/notice",
      workspace: "notices",
      severity: "warning",
      title: "Other renewal tenant communication ready for approval",
      description: "Saved renewal notice draft is ready for send approval review.",
      recommendedActionLabel: "Open notice review",
      recommendedActionHref: "/leases/lease-2/workflows/notice",
      dueAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      status: "open",
      leaseId: "lease-2",
      dedupeKey: "lease:lease-2:renewal_notice_send_review",
      auditEventIds: [],
    });
    const router = (await import("../landlordDecisionQueueRoutes")).default;

    const res = await invokeRouter(router, {
      method: "GET",
      url:
        "/decision-queue?sourceType=renewal_notice_send_review&sourceId=lease%3Alease-1%3Arenewal_notice_send_review&sourceRoute=%2Fleases%2Flease-1%2Fworkflows%2Fnotice",
    });

    expect(res.status).toBe(200);
    expect(res.body.filters).toEqual({
      severity: null,
      workspace: null,
      status: null,
      sourceType: "renewal_notice_send_review",
      sourceId: "lease:lease-1:renewal_notice_send_review",
      sourceRoute: "/leases/lease-1/workflows/notice",
    });
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id: "send-approval-lease-1",
        sourceId: "lease:lease-1:renewal_notice_send_review",
        sourceRoute: "/leases/lease-1/workflows/notice",
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
      sourceType: null,
      sourceId: null,
      sourceRoute: null,
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
