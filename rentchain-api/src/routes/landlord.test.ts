import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { fakeDb, queryCalls, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  const queryCalls: Array<{
    collection: string;
    filters: Array<{ field: string; operator: string; value: unknown }>;
    orderBy: Array<{ field: string; direction: string }>;
    limit: number | null;
  }> = [];

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function timestamp(value: unknown) {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Date.parse(value) || 0;
    if (value && typeof (value as any).toMillis === "function") return (value as any).toMillis();
    return 0;
  }

  function makeQuery(
    name: string,
    filters: Array<{ field: string; operator: string; value: unknown }> = [],
    orders: Array<{ field: string; direction: string }> = [],
    queryLimit: number | null = null
  ) {
    return {
      get: async () => {
        queryCalls.push({ collection: name, filters, orderBy: orders, limit: queryLimit });
        const rows = Array.from(ensureCollection(name).values()).filter((doc) =>
          filters.every((filter) => filter.operator === "==" && doc.data?.[filter.field] === filter.value)
        );
        rows.sort((left, right) => {
          for (const order of orders) {
            const leftValue = timestamp(left.data?.[order.field]);
            const rightValue = timestamp(right.data?.[order.field]);
            const comparison = leftValue - rightValue;
            if (comparison) return order.direction === "desc" ? -comparison : comparison;
          }
          return String(left.id).localeCompare(String(right.id));
        });
        const docs = rows.slice(0, queryLimit ?? rows.length).map((doc) => ({
          id: doc.id,
          exists: true,
          data: () => doc.data,
        }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id: string) => makeDoc(name, id),
      where: (field: string, operator: string, value: unknown) =>
        makeQuery(name, [...filters, { field, operator, value }], orders, queryLimit),
      orderBy: (field: string, direction = "asc") =>
        makeQuery(name, filters, [...orders, { field, direction }], queryLimit),
      limit: (value: number) => makeQuery(name, filters, orders, value),
    };
  }

  function makeDoc(name: string, id: string) {
    const collection = ensureCollection(name);
    return {
      id,
      get: async () => {
        const entry = collection.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = collection.get(id)?.data || {};
        collection.set(id, { id, data: options?.merge ? { ...current, ...value } : value });
      },
    };
  }

  return {
    queryCalls,
    resetFakeDb: () => {
      store.clear();
      queryCalls.length = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
        where: (field: string, operator: string, value: unknown) => makeQuery(name).where(field, operator, value),
      }),
    },
  };
});

const loadLandlordAnalyticsSnapshot = vi.fn();
let mockUser: any = null;
const PUBLIC_INBOX_KEYS = ["audienceRole", "body", "id", "occurredAt", "priority", "readAt", "sourceAction", "sourceKind", "status", "title"];
const EXCLUDED_INBOX_FIELDS = [
  "sourceId",
  "sourceRef",
  "audienceScopeKey",
  "rawIdsIncluded",
  "tokensIncluded",
  "secretsIncluded",
  "providerPayloadIncluded",
  "storagePathIncluded",
  "privateNotesIncluded",
];

vi.mock("../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../services/landlord/landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
}));

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

vi.mock("../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user.landlordId = landlordId;
    return next();
  },
}));

async function invokeRouter(router: any, options: { url: string; user?: any; method?: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? null;
    const req: any = {
      method: options.method || "GET",
      url: options.url,
      originalUrl: options.url,
      path,
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      body: options.body || {},
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

function seedLandlordSources() {
  seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Main property" });
  seedDoc("properties", "prop-2", { landlordId: "landlord-2", name: "Other property" });
  seedDoc("leases", "lease_raw_1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    title: "Lease renewal",
    summary: "Lease is ready for renewal.",
    priority: "normal",
    updatedAt: "2026-06-09T12:00:00.000Z",
  });
  seedDoc("maintenanceRequests", "maintenance_raw_1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    title: "Sink repair",
    status: "urgent",
    updatedAt: "2026-06-09T14:00:00.000Z",
  });
  seedDoc("maintenanceRequests", "maintenance_raw_2", {
    landlordId: "landlord-2",
    propertyId: "prop-2",
    title: "Other maintenance",
    status: "urgent",
    updatedAt: "2026-06-09T15:00:00.000Z",
  });
  seedDoc("conversations", "conversation_raw_1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    tenantDisplayName: "Taylor Tenant",
    propertyDisplayLabel: "Main property",
    unitDisplayLabel: "Unit 2A",
    lastMessageAt: "2026-06-09T13:00:00.000Z",
    lastReadAtLandlord: "2026-06-09T12:00:00.000Z",
  });
  seedDoc("messages", "message_raw_1", {
    conversationId: "conversation_raw_1",
    senderRole: "tenant",
    body: "Can we discuss the renewal?",
    createdAt: "2026-06-09T13:00:00.000Z",
  });
}

function expectSafeResponse(body: any) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("landlord-1");
  expect(serialized).not.toContain("lease_raw_1");
  expect(serialized).not.toContain("maintenance_raw_1");
  expect(serialized).not.toContain("message_raw_1");
  expect(serialized).not.toContain("\"providerPayload\":");
  expect(serialized).not.toContain("screeningReport");
  for (const item of body.items) {
    expect(item.id).toMatch(/^inbox_v1_/);
    expect(Object.keys(item).sort()).toEqual(PUBLIC_INBOX_KEYS);
    expect(item.audienceRole).toBe("landlord");
  }
  for (const field of EXCLUDED_INBOX_FIELDS) {
    expect(serialized).not.toContain(field);
  }
}

describe("landlord unified inbox route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = null;
    seedLandlordSources();
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      decisions: {
        items: [
          {
            id: "application_raw_1",
            landlordId: "landlord-1",
            propertyId: "prop-1",
            decisionType: "improve_application_conversion",
            title: "Application ready",
            summary: "Application needs review.",
            priority: "high",
            occurredAt: "2026-06-09T10:00:00.000Z",
          },
          {
            id: "screening_raw_1",
            landlordId: "landlord-1",
            propertyId: "prop-1",
            decisionType: "start_screening_checkout",
            title: "Screening ready",
            nextAction: "Review screening",
            priority: "high",
            occurredAt: "2026-06-09T11:00:00.000Z",
          },
          {
            id: "screening_raw_unsafe",
            landlordId: "landlord-1",
            propertyId: "prop-1",
            decisionType: "start_screening_checkout",
            title: "Screening unsafe",
            providerPayload: { raw: true },
            occurredAt: "2026-06-09T11:30:00.000Z",
          },
          {
            id: "application_raw_other",
            landlordId: "landlord-2",
            propertyId: "prop-2",
            decisionType: "improve_application_conversion",
            title: "Other application",
            occurredAt: "2026-06-09T16:00:00.000Z",
          },
        ],
      },
    });
  });

  it("requires authentication", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("rejects non-landlord roles", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox",
      user: { id: "tenant-1", role: "tenant" },
    });

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it("returns role-safe landlord inbox items with pagination metadata", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?limit=3&offset=0",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.limit).toBe(3);
    expect(res.body.offset).toBe(0);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items.map((item: any) => item.sourceKind)).toEqual(["landlord.message"]);
    expectSafeResponse(res.body);
  });

  it("filters by property, source, date range, and offset", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?propertyId=prop-1&source=message&dateFrom=2026-06-09T12:30:00.000Z&dateTo=2026-06-09T13:30:00.000Z&limit=1&offset=0",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].sourceKind).toBe("landlord.message");
    expect(res.body.items[0]).toMatchObject({
      title: "Message from Taylor Tenant",
      body: "Main property · Unit 2A — Can we discuss the renewal?",
      status: "unread",
      sourceAction: {
        href: "/messages?threadId=conversation_raw_1",
        routeKind: "messages_workspace",
      },
    });
    expect(loadLandlordAnalyticsSnapshot).not.toHaveBeenCalled();
    expectSafeResponse(res.body);
  });

  it("persists read state for safe landlord inbox records across refetches", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };

    const before = await invokeRouter(router, { url: "/inbox?limit=20", user });
    expect(before.status).toBe(200);
    const target = before.body.items.find((item: any) => item.status === "unread");
    expect(target?.id).toMatch(/^inbox_v1_/);

    const read = await invokeRouter(router, {
      method: "POST",
      url: `/inbox/${target.id}/read`,
      user,
    });
    expect(read.status).toBe(200);
    expect(read.body.record).toMatchObject({
      id: target.id,
      status: "read",
      readAt: expect.any(String),
    });

    const after = await invokeRouter(router, { url: "/inbox?limit=20", user });
    expect(after.status).toBe(200);
    const refreshed = after.body.items.find((item: any) => item.id === target.id);
    expect(refreshed).toMatchObject({
      id: target.id,
      status: "read",
      readAt: read.body.record.readAt,
    });
    expect(after.body.items.filter((item: any) => item.status === "unread")).toHaveLength(
      before.body.items.filter((item: any) => item.status === "unread").length - 1
    );
    expectSafeResponse(after.body);
  });

  it("marks message items read on the authoritative conversation instead of inbox-only state", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    const before = await invokeRouter(router, { url: "/inbox?source=message", user });
    const target = before.body.items[0];

    const read = await invokeRouter(router, { method: "POST", url: `/inbox/${target.id}/read`, user });
    expect(read.status).toBe(200);
    expect(read.body.record).toMatchObject({ status: "read", readAt: expect.any(String) });

    const conversation = await fakeDb.collection("conversations").doc("conversation_raw_1").get();
    expect(conversation.data().lastReadAtLandlord).toBe(read.body.record.readAt);
    const inboxReadStates = await fakeDb.collection("unifiedInboxReadStates").get();
    expect(inboxReadStates.docs).toHaveLength(0);
  });

  it("does not expose another landlord conversation or its child messages", async () => {
    seedDoc("conversations", "conversation_other", {
      landlordId: "landlord-2",
      propertyId: "prop-1",
      lastMessageAt: "2026-06-09T16:00:00.000Z",
    });
    seedDoc("messages", "message_other", {
      conversationId: "conversation_other",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      senderRole: "tenant",
      body: "Other landlord private message",
      createdAt: "2026-06-09T16:00:00.000Z",
    });
    seedDoc("messages", "message_orphan", {
      conversationId: "missing-conversation",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      senderRole: "tenant",
      body: "Orphaned private message",
      createdAt: "2026-06-09T17:00:00.000Z",
    });
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?source=message",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.body.total).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain("Other landlord private message");
    expect(JSON.stringify(res.body)).not.toContain("Orphaned private message");
    const messageQueries = queryCalls.filter((query) => query.collection === "messages");
    expect(messageQueries).toEqual([{
      collection: "messages",
      filters: [{ field: "conversationId", operator: "==", value: "conversation_raw_1" }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 21,
    }]);
    expect(queryCalls).not.toContainEqual(expect.objectContaining({
      collection: "messages",
      filters: [],
    }));
  });

  it("bounds owned conversations and message candidates with deterministic truncation", async () => {
    for (let index = 0; index < 101; index += 1) {
      const conversationId = `bounded-${String(index).padStart(3, "0")}`;
      seedDoc("conversations", conversationId, {
        landlordId: "landlord-1",
        lastMessageAt: 10_000 - index,
      });
      for (let messageIndex = 0; messageIndex < 22; messageIndex += 1) {
        seedDoc("messages", `${conversationId}-message-${String(messageIndex).padStart(2, "0")}`, {
          conversationId,
          senderRole: "tenant",
          body: `Message ${messageIndex}`,
          createdAt: 10_000 - messageIndex,
        });
      }
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?source=message&limit=100",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(100);
    expect(res.body.items).toHaveLength(100);
    const conversationQuery = queryCalls.find((query) => query.collection === "conversations");
    expect(conversationQuery).toMatchObject({
      filters: [{ field: "landlordId", operator: "==", value: "landlord-1" }],
      orderBy: [{ field: "lastMessageAt", direction: "desc" }],
      limit: 101,
    });
    const messageQueries = queryCalls.filter((query) => query.collection === "messages");
    expect(messageQueries).toHaveLength(100);
    expect(messageQueries.every((query) => query.limit === 21)).toBe(true);
    expect(messageQueries.every((query) => query.filters[0]?.field === "conversationId")).toBe(true);
    expect(warn).toHaveBeenCalledWith("[landlord-inbox] owned conversation limit reached", {
      code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
      collection: "conversations",
      limit: 100,
      observedCappedCount: 101,
      landlordScope: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
    expect(warn).toHaveBeenCalledWith("[landlord-inbox] per-conversation message limit reached", {
      code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
      collection: "messages",
      conversationCount: 99,
      limit: 20,
      observedCappedCount: 21,
    });
    warn.mockRestore();
  });

  it("uses only bounded server-scoped collection queries on the inbox request path", async () => {
    seedDoc("unifiedInboxReadStates", "owned-read-state", {
      landlordId: "landlord-1",
      recordId: "inbox_v1_owned",
      readAt: "2026-06-09T12:00:00.000Z",
    });
    seedDoc("unifiedInboxReadStates", "other-read-state", {
      landlordId: "landlord-2",
      recordId: "inbox_v1_other",
      readAt: "2026-06-09T12:00:00.000Z",
    });
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(queryCalls.map((query) => query.collection).sort()).toEqual([
      "conversations",
      "messages",
      "unifiedInboxReadStates",
    ]);
    expect(queryCalls.every((query) => query.filters.length > 0)).toBe(true);
    expect(queryCalls.every((query) => query.limit !== null && query.limit! > 0)).toBe(true);
    expect(queryCalls.find((query) => query.collection === "unifiedInboxReadStates")).toEqual({
      collection: "unifiedInboxReadStates",
      filters: [{ field: "landlordId", operator: "==", value: "landlord-1" }],
      orderBy: [],
      limit: 101,
    });
  });

  it.each([
    { count: 99, warns: false },
    { count: 100, warns: false },
    { count: 101, warns: true },
  ])("enforces the read-state boundary at $count records", async ({ count, warns }) => {
    for (let index = 0; index < count; index += 1) {
      seedDoc("unifiedInboxReadStates", `state-${String(index).padStart(3, "0")}`, {
        landlordId: "landlord-1",
        recordId: `inbox_v1_state_${index}`,
        readAt: "2026-06-09T12:00:00.000Z",
      });
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(200);
    const readStateQuery = queryCalls.find((query) => query.collection === "unifiedInboxReadStates");
    expect(readStateQuery?.limit).toBe(101);
    const limitWarnings = warn.mock.calls.filter(([message]) => message === "[landlord-inbox] read-state limit reached");
    expect(limitWarnings).toHaveLength(warns ? 1 : 0);
    if (warns) {
      expect(limitWarnings[0]?.[1]).toEqual({
        code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
        collection: "unifiedInboxReadStates",
        limit: 100,
        observedCappedCount: 101,
        landlordScope: expect.stringMatching(/^[a-f0-9]{12}$/),
      });
    }
    warn.mockRestore();
  });

  it("omits unsafe legacy projections with a structured governed warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const router = (await import("./landlordInboxRoutes")).default;
    await invokeRouter(router, {
      url: "/inbox",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(loadLandlordAnalyticsSnapshot).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[landlord-inbox] governed projections omitted", {
      code: "UNIFIED_INBOX_PROJECTIONS_OMITTED",
      collections: [
        "leases",
        "maintenanceRequests",
        "rentalApplications",
        "workOrders",
        "properties",
        "units",
        "events",
        "canonicalEvents",
        "financialTransactions",
        "screeningOrders",
      ],
      reason: "BOUNDED_CANONICAL_OWNERSHIP_QUERY_UNAVAILABLE",
    });
    warn.mockRestore();
  });

  it("contains no unrestricted collection loader or analytics snapshot dependency", () => {
    const source = readFileSync(new URL("./landlordInboxRoutes.ts", import.meta.url), "utf8");
    expect(source).not.toContain("loadLandlordAnalyticsSnapshot");
    expect(source).not.toContain("async function loadCollection");
    expect(source).not.toMatch(/\.collection\([^)]*\)\s*\.get\(/);
  });

  it("registers the read-state route expected by the /api/landlord mount", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const registeredRoutes = (router as any).stack
      .filter((layer: any) => layer?.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: layer.route.methods,
      }));

    expect(registeredRoutes).toContainEqual({
      path: "/inbox/:recordId/read",
      methods: expect.objectContaining({ post: true }),
    });
  });

  it("rejects cross-landlord property access before deriving inbox data", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?propertyId=prop-2",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      error: "PROPERTY_FORBIDDEN",
      message: "Property is not available",
    });
    expect(loadLandlordAnalyticsSnapshot).not.toHaveBeenCalled();
  });

  it("returns not found for unknown properties", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?propertyId=missing-prop",
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      error: "PROPERTY_NOT_FOUND",
      message: "Property not found",
    });
  });

  it("validates query parameters with safe error responses", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    const user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };

    await expect(invokeRouter(router, { url: "/inbox?limit=10000", user })).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: "INVALID_LIMIT" },
    });
    await expect(invokeRouter(router, { url: "/inbox?offset=-1", user })).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: "INVALID_OFFSET" },
    });
    await expect(invokeRouter(router, { url: "/inbox?source=admin", user })).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: "INVALID_SOURCE" },
    });
    await expect(invokeRouter(router, { url: "/inbox?dateFrom=nope", user })).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: "INVALID_DATE_FROM" },
    });
  });

  it("returns an empty array for landlords with no inbox items", async () => {
    const router = (await import("./landlordInboxRoutes")).default;
    loadLandlordAnalyticsSnapshot.mockResolvedValueOnce({ decisions: { items: [] } });

    const res = await invokeRouter(router, {
      url: "/inbox",
      user: { id: "landlord-empty", landlordId: "landlord-empty", role: "landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });
});
