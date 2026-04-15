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

vi.mock("../../config/firebase", () => ({
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
  options: { method: string; url: string; user?: Record<string, unknown> | null }
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
      params: {},
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

function seedCanonicalEvent(id: string, data: any) {
  if (!collections.has("canonicalEvents")) {
    collections.set("canonicalEvents", new Map<string, any>());
  }
  collections.get("canonicalEvents")!.set(id, { id, ...data });
}

describe("timelineRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns timeline events in reverse chronological order", async () => {
    seedCanonicalEvent("event-1", {
      id: "event-1",
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "internal",
      summary: "Application created",
    });
    seedCanonicalEvent("event-2", {
      id: "event-2",
      version: "v1",
      type: "lease.activated",
      domain: "lease",
      action: "activated",
      status: "active",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-04-02T09:00:00.000Z",
      recordedAt: "2026-04-02T09:00:00.000Z",
      visibility: "landlord",
      summary: "Lease activated",
    });

    const router = (await import("../timelineRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/timeline",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.events).toEqual([
      expect.objectContaining({
        id: "event-2",
        title: "Lease activated",
        domain: "lease",
      }),
      expect.objectContaining({
        id: "event-1",
        title: "Application created",
        domain: "application",
      }),
    ]);
  });

  it("filters by domain and resource id", async () => {
    seedCanonicalEvent("event-1", {
      id: "event-1",
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-03T10:00:00.000Z",
      recordedAt: "2026-04-03T10:00:00.000Z",
      visibility: "landlord",
      summary: "Screening payment completed",
    });
    seedCanonicalEvent("event-2", {
      id: "event-2",
      version: "v1",
      type: "maintenance.completed",
      domain: "maintenance",
      action: "completed",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "maintenance_request", id: "maint-1" },
      occurredAt: "2026-04-03T11:00:00.000Z",
      recordedAt: "2026-04-03T11:00:00.000Z",
      visibility: "landlord",
      summary: "Maintenance request marked completed",
    });

    const router = (await import("../timelineRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/timeline?domain=screening&resourceId=app-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.events).toHaveLength(1);
    expect(response.body?.events[0]).toEqual(
      expect.objectContaining({
        id: "event-1",
        domain: "screening",
      })
    );
  });

  it("returns a next cursor when another page exists", async () => {
    seedCanonicalEvent("event-1", {
      id: "event-1",
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "internal",
      summary: "Application created",
    });
    seedCanonicalEvent("event-2", {
      id: "event-2",
      version: "v1",
      type: "application.submitted",
      domain: "application",
      action: "submitted",
      actor: { type: "tenant", role: "tenant", id: "tenant-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-02T09:00:00.000Z",
      recordedAt: "2026-04-02T09:00:00.000Z",
      visibility: "internal",
      summary: "Application submitted",
    });

    const router = (await import("../timelineRoutes")).default;
    const firstPage = await invokeRouter(router, {
      method: "GET",
      url: "/timeline?limit=1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(firstPage.status).toBe(200);
    expect(firstPage.body?.events).toHaveLength(1);
    expect(firstPage.body?.nextCursor).toBeTruthy();

    const secondPage = await invokeRouter(router, {
      method: "GET",
      url: `/timeline?limit=1&cursor=${encodeURIComponent(String(firstPage.body?.nextCursor))}`,
      user: { id: "admin-1", role: "admin" },
    });

    expect(secondPage.status).toBe(200);
    expect(secondPage.body?.events).toHaveLength(1);
    expect(secondPage.body?.events[0]?.id).toBe("event-1");
  });
});
