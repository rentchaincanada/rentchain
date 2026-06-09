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
      doc: (id: string) => makeDoc(name, id),
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
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
      }),
    },
  };
});

const loadLandlordAnalyticsSnapshot = vi.fn();
let mockUser: any = null;

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
  seedDoc("messages", "message_raw_1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
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
    expect(item.sourceId).toMatch(/^inbox_v1_/);
    expect(item.audienceScopeKey).toMatch(/^scope_v1_/);
    expect(item.rawIdsIncluded).toBe(false);
    expect(item.providerPayloadIncluded).toBe(false);
    expect(item.storagePathIncluded).toBe(false);
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
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.map((item: any) => item.sourceKind)).toEqual([
      "landlord.maintenance",
      "landlord.screening",
      "landlord.application",
    ]);
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
    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      propertyId: "prop-1",
    });
    expectSafeResponse(res.body);
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
