import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function makeQuery(name: string) {
    return {
      get: async () => {
        const docs = Array.from(ensureCollection(name).values()).map((doc) => ({
          id: doc.id,
          exists: true,
          data: () => doc.data,
        }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        get: async () => makeQuery(name).get(),
      }),
    },
  };
});

let mockUser: any = null;
const PUBLIC_INBOX_KEYS = ["audienceRole", "body", "id", "occurredAt", "priority", "readAt", "sourceKind", "status", "title"];
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

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

async function invokeRouter(router: any, options: { url: string; user?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    mockUser = options.user ?? null;
    const req: any = {
      method: "GET",
      url: options.url,
      originalUrl: options.url,
      path,
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      body: {},
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

function tenantUser(overrides: Record<string, any> = {}) {
  return {
    id: "user-1",
    role: "tenant",
    tenantId: "tenant-1",
    tenantWorkspaceId: "tenant-workspace-1",
    ...overrides,
  };
}

function seedTenantSources() {
  seedDoc("tenantNotifications", "notification_raw_1", {
    tenantWorkspaceId: "tenant-workspace-1",
    sourceKind: "tenant.notice",
    title: "Notice available",
    summary: "A notice is ready.",
    priority: "high",
    createdAt: "2026-06-09T10:00:00.000Z",
  });
  seedDoc("rentalApplications", "application_raw_1", {
    tenantId: "tenant-1",
    title: "Application submitted",
    status: "submitted",
    priority: "normal",
    submittedAt: "2026-06-09T11:00:00.000Z",
  });
  seedDoc("leases", "lease_raw_1", {
    tenantId: "tenant-1",
    title: "Lease ready",
    status: "ready",
    priority: "normal",
    updatedAt: "2026-06-09T12:00:00.000Z",
  });
  seedDoc("tenantNotices", "tenant_notice_raw_1", {
    tenantId: "tenant-1",
    title: "Rent notice",
    message: "A rent notice is available.",
    priority: "normal",
    createdAt: "2026-06-09T13:00:00.000Z",
  });
  seedDoc("messages", "message_raw_1", {
    tenantId: "tenant-1",
    senderRole: "landlord",
    body: "Can we confirm the viewing?",
    priority: "normal",
    createdAt: "2026-06-09T14:00:00.000Z",
  });
  seedDoc("maintenanceRequests", "maintenance_raw_1", {
    tenantId: "tenant-1",
    title: "Sink repair",
    status: "urgent",
    priority: "high",
    updatedAt: "2026-06-09T15:00:00.000Z",
  });
  seedDoc("screening_requests", "screening_raw_1", {
    applicantTenantId: "tenant-1",
    status: "consent_pending",
    requestedAt: "2026-06-09T16:00:00.000Z",
  });
  seedDoc("messages", "message_raw_other", {
    tenantId: "tenant-2",
    senderRole: "landlord",
    body: "Other tenant message",
    createdAt: "2026-06-09T17:00:00.000Z",
  });
  seedDoc("tenantNotifications", "notification_raw_unsafe", {
    tenantWorkspaceId: "tenant-workspace-1",
    sourceKind: "tenant.notice",
    title: "Unsafe notification",
    summary: "providerPayload should not pass",
    providerPayload: { raw: true },
    createdAt: "2026-06-09T18:00:00.000Z",
  });
  seedDoc("rentalApplications", "application_raw_unsafe", {
    tenantId: "tenant-1",
    title: "Application with notes",
    landlordNotes: "private landlord note",
    submittedAt: "2026-06-09T19:00:00.000Z",
  });
}

function expectSafeResponse(body: any) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("tenant-1");
  expect(serialized).not.toContain("tenant-workspace-1");
  expect(serialized).not.toContain("notification_raw_1");
  expect(serialized).not.toContain("application_raw_1");
  expect(serialized).not.toContain("lease_raw_1");
  expect(serialized).not.toContain("message_raw_1");
  expect(serialized).not.toContain("maintenance_raw_1");
  expect(serialized).not.toContain("screening_raw_1");
  expect(serialized).not.toContain("landlordNotes");
  expect(serialized).not.toContain("\"providerPayload\":");
  expect(serialized).not.toContain("screeningReport");
  for (const item of body.items) {
    expect(item.id).toMatch(/^inbox_v1_/);
    expect(Object.keys(item).sort()).toEqual(PUBLIC_INBOX_KEYS);
    expect(item.audienceRole).toBe("tenant");
  }
  for (const field of EXCLUDED_INBOX_FIELDS) {
    expect(serialized).not.toContain(field);
  }
}

describe("tenant unified inbox route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = null;
    seedTenantSources();
  });

  it("requires authentication", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("requires tenant workspace identity", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox", user: tenantUser({ tenantId: "" }) });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
  });

  it("rejects non-tenant roles", async () => {
    const router = (await import("./tenantInboxRoutes")).default;

    await expect(invokeRouter(router, { url: "/inbox", user: { id: "landlord-1", role: "landlord", landlordId: "landlord-1" } })).resolves.toMatchObject({
      status: 403,
      body: { ok: false, error: "FORBIDDEN" },
    });
    await expect(invokeRouter(router, { url: "/inbox", user: { id: "contractor-1", role: "contractor", contractorId: "contractor-1" } })).resolves.toMatchObject({
      status: 403,
      body: { ok: false, error: "FORBIDDEN" },
    });
    await expect(invokeRouter(router, { url: "/inbox", user: { id: "admin-1", role: "admin" } })).resolves.toMatchObject({
      status: 403,
      body: { ok: false, error: "FORBIDDEN" },
    });
  });

  it("returns safe tenant-projected inbox items with pagination metadata", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox?limit=4&offset=0", user: tenantUser() });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.limit).toBe(4);
    expect(res.body.offset).toBe(0);
    expect(res.body.total).toBe(7);
    expect(res.body.items).toHaveLength(4);
    expect(res.body.items.map((item: any) => item.sourceKind)).toEqual([
      "tenant.screening",
      "tenant.maintenance",
      "tenant.notice",
      "tenant.message",
    ]);
    expectSafeResponse(res.body);
  });

  it("filters by source and date range", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?source=message&dateFrom=2026-06-09T13:30:00.000Z&dateTo=2026-06-09T14:30:00.000Z",
      user: tenantUser(),
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].sourceKind).toBe("tenant.message");
    expectSafeResponse(res.body);
  });

  it("applies limit and offset pagination", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const first = await invokeRouter(router, { url: "/inbox?limit=2&offset=0", user: tenantUser() });
    const second = await invokeRouter(router, { url: "/inbox?limit=2&offset=2", user: tenantUser() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.total).toBe(7);
    expect(second.body.total).toBe(7);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(2);
    expect(first.body.items.map((item: any) => item.id)).not.toEqual(second.body.items.map((item: any) => item.id));
    expectSafeResponse(first.body);
    expectSafeResponse(second.body);
  });

  it("rejects explicit cross-tenant scope attempts", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox?tenantId=tenant-2", user: tenantUser() });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      error: "TENANT_SCOPE_FORBIDDEN",
      message: "Tenant scope is not available",
    });
  });

  it("validates query parameters with safe error responses", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const user = tenantUser();

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
    await expect(
      invokeRouter(router, {
        url: "/inbox?dateFrom=2026-06-10T00:00:00.000Z&dateTo=2026-06-09T00:00:00.000Z",
        user,
      })
    ).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: "INVALID_DATE_RANGE" },
    });
  });

  it("returns an empty array when no items match", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, {
      url: "/inbox?dateFrom=2027-01-01T00:00:00.000Z&dateTo=2027-01-02T00:00:00.000Z",
      user: tenantUser(),
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

  it("does not return records from other tenants or unsafe source records", async () => {
    const router = (await import("./tenantInboxRoutes")).default;
    const res = await invokeRouter(router, { url: "/inbox?limit=100", user: tenantUser() });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(7);
    expect(JSON.stringify(res.body)).not.toContain("Other tenant message");
    expect(JSON.stringify(res.body)).not.toContain("Unsafe notification");
    expect(JSON.stringify(res.body)).not.toContain("Application with notes");
    expectSafeResponse(res.body);
  });
});
