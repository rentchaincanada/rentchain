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
        doc: (id: string) => ({
          async get() {
            return {
              id,
              exists: ensureCollection(name).has(id),
              data: () => ensureCollection(name).get(id),
            };
          },
          async set(value: any) {
            ensureCollection(name).set(id, value);
          },
        }),
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs };
        },
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: vi.fn().mockResolvedValue(undefined),
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      body: options.body || {},
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const match = path.match(/\/assignments\/([^/]+)$/);
    if (match) {
      req.params.assignmentId = decodeURIComponent(match[1]);
    }
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

describe("adminAssignmentRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates and fetches an assignment record", async () => {
    const router = (await import("../adminAssignmentRoutes")).default;
    const created = await invokeRouter(router, {
      method: "POST",
      url: "/assignments",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "application",
        resourceId: "app-1",
        ownerId: "admin-2",
        ownerLabel: "Jordan Admin",
        note: "Taking ownership",
      },
    });

    expect(created.status).toBe(201);
    expect(created.body.assignment).toEqual(
      expect.objectContaining({
        resource: { type: "application", id: "app-1" },
        currentOwner: { ownerId: "admin-2", ownerLabel: "Jordan Admin" },
      })
    );

    const fetched = await invokeRouter(router, {
      method: "GET",
      url: "/assignments?resourceType=application&resourceId=app-1",
      user: { id: "admin-1", role: "admin" },
    });
    expect(fetched.status).toBe(200);
    expect(fetched.body.assignment.id).toBe(created.body.assignment.id);
  });

  it("upserts by exact resource and appends history on change and clear", async () => {
    const router = (await import("../adminAssignmentRoutes")).default;
    const created = await invokeRouter(router, {
      method: "POST",
      url: "/assignments",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "maintenance",
        resourceId: "maint-1",
        ownerId: "admin-2",
        ownerLabel: "Jordan Admin",
      },
    });

    const changed = await invokeRouter(router, {
      method: "POST",
      url: "/assignments",
      user: { id: "admin-1", role: "admin" },
      body: {
        resourceType: "maintenance",
        resourceId: "maint-1",
        ownerId: "admin-3",
        ownerLabel: "Taylor Admin",
      },
    });
    expect(changed.status).toBe(200);
    expect(changed.body.assignment.history).toHaveLength(2);

    const cleared = await invokeRouter(router, {
      method: "PATCH",
      url: `/assignments/${created.body.assignment.id}`,
      user: { id: "admin-1", role: "admin" },
      body: {
        ownerId: null,
        ownerLabel: null,
        note: "Clearing owner",
      },
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.assignment.currentOwner).toEqual({ ownerId: null, ownerLabel: null });
    expect(cleared.body.assignment.history).toHaveLength(3);
    expect(cleared.body.assignment.history.at(-1)).toEqual(expect.objectContaining({ action: "cleared" }));
  });

  it("enforces admin-only access and stable validation", async () => {
    const router = (await import("../adminAssignmentRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/assignments?resourceType=application&resourceId=app-1",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe("FORBIDDEN");

    const invalid = await invokeRouter(router, {
      method: "POST",
      url: "/assignments",
      user: { id: "admin-1", role: "admin" },
      body: { resourceType: "application", resourceId: "app-1" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("OWNER_ID_REQUIRED");
  });

  it("returns a stable null shape when no assignment exists", async () => {
    const router = (await import("../adminAssignmentRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/assignments?resourceType=lease&resourceId=lease-1",
      user: { id: "admin-1", role: "admin" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ assignment: null });
  });
});
