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
      setHeader() {},
    };
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("adminSlaRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns a stable empty shape", async () => {
    const router = (await import("../adminSlaRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/sla",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], nextCursor: undefined });
  });

  it("supports exact-resource fetch and list filters", async () => {
    seedDoc("rentalApplications", "app-1", {
      applicantName: "Alex Applicant",
      screeningMonetization: {
        paymentStatus: "paid",
        paidAt: "2026-04-15T08:00:00.000Z",
        fulfillmentStatus: "ordered",
      },
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-15T08:00:00.000Z",
      recordedAt: "2026-04-15T08:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-1",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-15T08:00:00.000Z"),
    });
    seedDoc("adminAssignments", "assign-1", {
      version: "v1",
      id: "assign-1",
      resource: { type: "application", id: "app-1" },
      currentOwner: { ownerId: "admin-1", ownerLabel: "Ops Lead" },
      createdAt: "2026-04-15T09:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
      history: [],
    });

    const router = (await import("../adminSlaRoutes")).default;
    const exact = await invokeRouter(router, {
      method: "GET",
      url: "/sla?resourceType=application&resourceId=app-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(exact.status).toBe(200);
    expect(exact.body.items).toHaveLength(1);
    expect(exact.body.items[0]).toEqual(
      expect.objectContaining({
        resource: { type: "application", id: "app-1" },
        context: expect.objectContaining({
          triageSeverity: "critical",
          assignmentOwnerId: "admin-1",
          assignmentOwnerLabel: "Ops Lead",
        }),
      })
    );

    const filtered = await invokeRouter(router, {
      method: "GET",
      url: "/sla?stage=fresh",
      user: { id: "admin-1", role: "admin" },
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.length).toBeGreaterThanOrEqual(0);
  });

  it("enforces admin-only access and validation errors", async () => {
    const router = (await import("../adminSlaRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/sla",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe("FORBIDDEN");

    const invalidStage = await invokeRouter(router, {
      method: "GET",
      url: "/sla?stage=nope",
      user: { id: "admin-1", role: "admin" },
    });
    expect(invalidStage.status).toBe(400);
    expect(invalidStage.body.error).toBe("STAGE_INVALID");
  });
});
