import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
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
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const paramsMatch = path.match(/\/resolutions\/([^/]+)\/(status|notes)$/);
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: paramsMatch
        ? { resolutionId: paramsMatch[1] }
        : {},
      body: options.body || {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("adminResolutionRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates and upserts a resolution deterministically", async () => {
    const router = (await import("../adminResolutionRoutes")).default;

    const created = await invokeRouter(router, {
      method: "POST",
      url: "/resolutions",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "application",
        resourceId: "app-1",
        reasonCode: "TRIAGE_PAID_NOT_FULFILLED",
        note: "Investigating fulfillment lag.",
      },
    });

    expect(created.status).toBe(201);
    expect(created.body?.resolution?.status).toBe("open");
    expect(created.body?.resolution?.notes).toHaveLength(1);

    const upserted = await invokeRouter(router, {
      method: "POST",
      url: "/resolutions",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "application",
        resourceId: "app-1",
        reasonCode: "TRIAGE_PAID_NOT_FULFILLED",
        note: "Second note.",
      },
    });

    expect(upserted.status).toBe(200);
    expect(upserted.body?.resolution?.id).toBe(created.body?.resolution?.id);
    expect(upserted.body?.resolution?.notes).toHaveLength(2);
  });

  it("supports valid status transitions and note appends", async () => {
    const router = (await import("../adminResolutionRoutes")).default;
    const created = await invokeRouter(router, {
      method: "POST",
      url: "/resolutions",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "maintenance",
        resourceId: "maint-1",
        reasonCode: "TRIAGE_WORKFLOW_STALLED",
      },
    });
    const resolutionId = created.body?.resolution?.id;

    const acknowledged = await invokeRouter(router, {
      method: "PATCH",
      url: `/resolutions/${resolutionId}/status`,
      user: { id: "admin-1", role: "admin" },
      body: { status: "acknowledged", reason: "Owner has reviewed the stall." },
    });
    expect(acknowledged.status).toBe(200);
    expect(acknowledged.body?.resolution?.status).toBe("acknowledged");

    const noted = await invokeRouter(router, {
      method: "POST",
      url: `/resolutions/${resolutionId}/notes`,
      user: { id: "admin-1", role: "admin" },
      body: { message: "Awaiting contractor update." },
    });
    expect(noted.status).toBe(200);
    expect(noted.body?.resolution?.notes).toHaveLength(1);
  });

  it("rejects invalid transitions and returns stable empty fetch shape", async () => {
    const router = (await import("../adminResolutionRoutes")).default;
    const empty = await invokeRouter(router, {
      method: "GET",
      url: "/resolutions?resourceType=lease&resourceId=lease-1",
      user: { id: "admin-1", role: "admin" },
    });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ resolution: null });

    const created = await invokeRouter(router, {
      method: "POST",
      url: "/resolutions",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "lease",
        resourceId: "lease-1",
        reasonCode: "TRIAGE_POLICY_BLOCKED",
      },
    });
    const resolutionId = created.body?.resolution?.id;

    const invalid = await invokeRouter(router, {
      method: "PATCH",
      url: `/resolutions/${resolutionId}/status`,
      user: { id: "admin-1", role: "admin" },
      body: { status: "resolved" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body?.error).toBe("RESOLUTION_STATUS_TRANSITION_INVALID");
  });

  it("enforces admin-only access", async () => {
    const router = (await import("../adminResolutionRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "POST",
      url: "/resolutions",
      user: { id: "landlord-1", role: "landlord" },
      body: {
        resourceType: "application",
        resourceId: "app-1",
      },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.error).toBe("FORBIDDEN");
  });
});
