import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }
  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => ({
          id,
          async get() {
            return {
              id,
              exists: ensureCollection(name).has(String(id)),
              data: () => ensureCollection(name).get(String(id)),
            };
          },
          async set(payload: any) {
            ensureCollection(name).set(String(id), payload);
          },
        }),
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({ id, data: () => data }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../firebase", () => ({ db: dbMock }));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: any; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const paramsMatch = path.match(/\/alerts\/([^/]+)\/acknowledge|\/watchlist\/([^/]+)$/);
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: paramsMatch ? { alertId: paramsMatch[1], watchId: paramsMatch[2] } : {},
      body: options.body || {},
      headers: {},
      get(name: string) { return this.headers[String(name).toLowerCase()]; },
      header(name: string) { return this.get(name); },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { resolve({ status: this.statusCode, body: payload }); return this; },
      send(payload: any) { resolve({ status: this.statusCode, body: payload }); return this; },
      setHeader() {},
    };
    router.handle(req, res, (error: any) => error ? reject(error) : undefined);
  });
}

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) collections.set(collectionName, new Map<string, any>());
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("adminAlertingRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns stable empty states and enforces admin-only access", async () => {
    const router = (await import("../adminAlertingRoutes")).default;
    const empty = await invokeRouter(router, {
      method: "GET",
      url: "/alerts",
      user: { id: "admin-1", role: "admin" },
    });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ alerts: [], nextCursor: undefined });

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/alerts",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
  });

  it("acknowledges alerts and supports watchlist create/update/fetch", async () => {
    const router = (await import("../adminAlertingRoutes")).default;

    const acknowledged = await invokeRouter(router, {
      method: "PATCH",
      url: "/alerts/alert-1/acknowledge",
      user: { id: "admin-1", role: "admin" },
      body: { acknowledged: true },
    });
    expect(acknowledged.status).toBe(200);
    expect(acknowledged.body?.state?.acknowledged).toBe(true);

    const created = await invokeRouter(router, {
      method: "POST",
      url: "/watchlist",
      user: { id: "admin-1", role: "admin" },
      body: {
        targetType: "application",
        targetId: "app-1",
        notes: "Keep an eye on this workflow.",
      },
    });
    expect(created.status).toBe(201);
    const watchId = created.body?.watch?.id;

    const updated = await invokeRouter(router, {
      method: "PATCH",
      url: `/watchlist/${watchId}`,
      user: { id: "admin-1", role: "admin" },
      body: { isActive: false },
    });
    expect(updated.status).toBe(200);
    expect(updated.body?.watch?.isActive).toBe(false);

    const fetched = await invokeRouter(router, {
      method: "GET",
      url: "/watchlist?activeOnly=false",
      user: { id: "admin-1", role: "admin" },
    });
    expect(fetched.status).toBe(200);
    expect(fetched.body?.watchlist).toHaveLength(1);
  });
});
