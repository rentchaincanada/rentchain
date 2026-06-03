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

describe("insightRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("lets an admin fetch a resource insight", async () => {
    seedCanonicalEvent("event-1", {
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

    const router = (await import("../insightRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/insights/resource?resourceType=rental_application&resourceId=app-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.insight).toEqual(
      expect.objectContaining({
        domain: "application",
        resourceType: "rental_application",
        resourceId: "app-1",
        summary: expect.objectContaining({
          lifecycleState: "submitted",
        }),
      })
    );
  });

  it("lets an admin fetch a summary insight list with paging", async () => {
    seedCanonicalEvent("event-1", {
      version: "v1",
      type: "screening.quote_generated",
      domain: "screening",
      action: "quote_generated",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-1" },
      occurredAt: "2026-04-01T09:00:00.000Z",
      recordedAt: "2026-04-01T09:00:00.000Z",
      visibility: "internal",
      summary: "Screening quote generated",
    });
    seedCanonicalEvent("event-2", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-2" },
      occurredAt: "2026-04-02T09:00:00.000Z",
      recordedAt: "2026-04-02T09:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });

    const router = (await import("../insightRoutes")).default;
    const firstPage = await invokeRouter(router, {
      method: "GET",
      url: "/insights/summary?domain=screening&limit=1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(firstPage.status).toBe(200);
    expect(firstPage.body?.insights).toHaveLength(1);
    expect(firstPage.body?.insights[0]?.resourceId).toBe("order-2");
    expect(firstPage.body?.nextCursor).toBeTruthy();

    const secondPage = await invokeRouter(router, {
      method: "GET",
      url: `/insights/summary?domain=screening&limit=1&cursor=${encodeURIComponent(String(firstPage.body?.nextCursor))}`,
      user: { id: "admin-1", role: "admin" },
    });

    expect(secondPage.status).toBe(200);
    expect(secondPage.body?.insights).toHaveLength(1);
    expect(secondPage.body?.insights[0]?.resourceId).toBe("order-1");
  });

  it("returns a safe validation error for malformed queries", async () => {
    const router = (await import("../insightRoutes")).default;
    const resourceResponse = await invokeRouter(router, {
      method: "GET",
      url: "/insights/resource?resourceType=rental_application",
      user: { id: "admin-1", role: "admin" },
    });
    expect(resourceResponse.status).toBe(400);
    expect(resourceResponse.body?.error).toBe("RESOURCE_QUERY_INVALID");

    const summaryResponse = await invokeRouter(router, {
      method: "GET",
      url: "/insights/summary?domain=nope",
      user: { id: "admin-1", role: "admin" },
    });
    expect(summaryResponse.status).toBe(400);
    expect(summaryResponse.body?.error).toBe("DOMAIN_INVALID");
  });

  it("returns a stable empty response shape when no events match", async () => {
    const router = (await import("../insightRoutes")).default;
    const resourceResponse = await invokeRouter(router, {
      method: "GET",
      url: "/insights/resource?resourceType=rental_application&resourceId=missing",
      user: { id: "admin-1", role: "admin" },
    });
    expect(resourceResponse.status).toBe(200);
    expect(resourceResponse.body).toEqual({ insight: null });

    const summaryResponse = await invokeRouter(router, {
      method: "GET",
      url: "/insights/summary?domain=application&limit=10",
      user: { id: "admin-1", role: "admin" },
    });
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body).toEqual({ insights: [], nextCursor: undefined });
  });
});
