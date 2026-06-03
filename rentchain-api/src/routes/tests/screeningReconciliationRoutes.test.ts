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
      params: path.split("/").length > 3 ? { applicationId: path.split("/").pop() } : {},
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

describe("screeningReconciliationRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("lets an admin fetch application reconciliation", async () => {
    const recentQuoteAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    seedDoc("rentalApplications", "app-1", {
      screeningMonetization: {
        quoteStatus: "generated",
        quoteId: "quote-1",
        quoteGeneratedAt: recentQuoteAt,
      },
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.quote_generated",
      domain: "screening",
      action: "quote_generated",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: recentQuoteAt,
      recordedAt: recentQuoteAt,
      visibility: "internal",
      summary: "Screening quote generated",
    });

    const router = (await import("../screeningReconciliationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/application/app-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.reconciliation).toEqual(
      expect.objectContaining({
        applicationId: "app-1",
        status: "quoted",
      })
    );
  });

  it("lets an admin fetch summary reconciliations", async () => {
    seedDoc("rentalApplications", "app-1", {
      screeningMonetization: {
        quoteStatus: "generated",
        quoteGeneratedAt: "2026-04-01T10:00:00.000Z",
      },
    });
    seedDoc("rentalApplications", "app-2", {
      screeningMonetization: {
        paymentStatus: "paid",
        fulfillmentStatus: "ordered",
        paidAt: "2026-04-02T10:00:00.000Z",
      },
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.quote_generated",
      domain: "screening",
      action: "quote_generated",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-01T10:00:00.000Z",
      recordedAt: "2026-04-01T10:00:00.000Z",
      visibility: "internal",
      summary: "Screening quote generated",
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: null },
      resource: { type: "rental_application", id: "app-2" },
      occurredAt: "2026-04-02T10:00:00.000Z",
      recordedAt: "2026-04-02T10:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-2",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-02T10:00:00.000Z"),
    });

    const router = (await import("../screeningReconciliationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/summary?limit=10",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.reconciliations).toHaveLength(2);
  });

  it("filters summary by status", async () => {
    seedDoc("rentalApplications", "app-1", {
      screeningMonetization: {
        quoteStatus: "generated",
        quoteGeneratedAt: "2026-04-01T10:00:00.000Z",
      },
    });
    seedDoc("rentalApplications", "app-2", {
      screeningMonetization: {
        paymentStatus: "paid",
        fulfillmentStatus: "ordered",
        paidAt: "2026-04-02T10:00:00.000Z",
      },
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "screening.quote_generated",
      domain: "screening",
      action: "quote_generated",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-01T10:00:00.000Z",
      recordedAt: "2026-04-01T10:00:00.000Z",
      visibility: "internal",
      summary: "Screening quote generated",
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: null },
      resource: { type: "rental_application", id: "app-2" },
      occurredAt: "2026-04-02T10:00:00.000Z",
      recordedAt: "2026-04-02T10:00:00.000Z",
      visibility: "internal",
      summary: "Screening paid",
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-2",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-02T10:00:00.000Z"),
    });

    const router = (await import("../screeningReconciliationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/summary?status=paid_not_fulfilled",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.reconciliations).toHaveLength(1);
    expect(response.body?.reconciliations[0]?.applicationId).toBe("app-2");
  });

  it("returns stable validation errors for malformed queries", async () => {
    const router = (await import("../screeningReconciliationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/summary?status=nope",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe("STATUS_INVALID");
  });

  it("returns stable empty response shapes", async () => {
    const router = (await import("../screeningReconciliationRoutes")).default;
    const applicationResponse = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/application/app-missing",
      user: { id: "admin-1", role: "admin" },
    });
    expect(applicationResponse.status).toBe(200);
    expect(applicationResponse.body).toEqual({ reconciliation: null });

    const summaryResponse = await invokeRouter(router, {
      method: "GET",
      url: "/screening-reconciliation/summary?limit=10",
      user: { id: "admin-1", role: "admin" },
    });
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body).toEqual({ reconciliations: [], nextCursor: undefined });
  });
});
