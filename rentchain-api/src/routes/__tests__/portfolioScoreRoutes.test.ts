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

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("portfolioScoreRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("lets an admin fetch a portfolio score", async () => {
    seedDoc("rentalApplications", "app-1", {
      landlordId: "portfolio-1",
      applicantName: "Alex Applicant",
      screeningMonetization: {
        paymentStatus: "paid",
        paidAt: "2026-04-15T08:00:00.000Z",
        fulfillmentStatus: "completed",
      },
    });
    seedDoc("financialTransactions", "tx-1", {
      landlordId: "portfolio-1",
      applicationId: "app-1",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-15T08:00:00.000Z"),
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
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "screening.completed",
      domain: "screening",
      action: "completed",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-15T09:00:00.000Z",
      recordedAt: "2026-04-15T09:00:00.000Z",
      visibility: "internal",
      summary: "Screening completed",
    });

    const router = (await import("../portfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score?portfolioId=portfolio-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.portfolioScore).toEqual(
      expect.objectContaining({
        portfolioId: "portfolio-1",
        grade: expect.any(String),
        score: expect.any(Number),
        components: expect.any(Array),
      })
    );
  });

  it("enforces admin-only access and safe validation", async () => {
    const router = (await import("../portfolioScoreRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score?portfolioId=portfolio-1",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.error).toBe("FORBIDDEN");

    const invalid = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score",
      user: { id: "admin-1", role: "admin" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body?.error).toBe("PORTFOLIO_ID_REQUIRED");
  });

  it("returns a stable sparse payload when the portfolio has no resources yet", async () => {
    const router = (await import("../portfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score?portfolioId=portfolio-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.portfolioScore?.portfolioId).toBe("portfolio-1");
    expect(response.body?.portfolioScore?.summary?.notes).toEqual(
      expect.arrayContaining([expect.stringMatching(/Sparse portfolio data/i)])
    );
  });
});

