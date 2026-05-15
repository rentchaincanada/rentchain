import express from "express";
import { describe, expect, it, vi } from "vitest";
import { routeSource } from "../../middleware/routeSource";

const collections = vi.hoisted(() => new Map<string, Map<string, any>>());

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

vi.mock("../../config/firebase", () => ({
  db: {
    runTransaction: async (handler: any) =>
      handler({
        get: async (ref: any) => ref.get(),
        set: async (ref: any, value: any, opts?: { merge?: boolean }) => ref.set(value, opts),
      }),
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `${name}-${ensureCollection(name).size + 1}`;
        return {
          id: docId,
          get: async () => {
            const value = ensureCollection(name).get(docId);
            return { id: docId, exists: Boolean(value), data: () => value };
          },
          set: async (value: any, opts?: { merge?: boolean }) => {
            const current = ensureCollection(name).get(docId) || {};
            ensureCollection(name).set(docId, opts?.merge ? { ...current, ...value } : value);
          },
        };
      },
      where: () => ({
        limit: () => ({
          get: async () => ({ docs: [] }),
        }),
      }),
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ docs: [] }),
        }),
      }),
    }),
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/ledgerEventsService", () => ({
  recordPaymentEvent: vi.fn(),
}));

vi.mock("../../services/leaseService", () => ({
  leaseService: {},
}));

vi.mock("../../services/screeningJobs", () => ({
  claimNextJob: vi.fn(async () => ({ ok: true, job: null })),
  enqueueScreeningJob: vi.fn(async () => ({ ok: true })),
  runJob: vi.fn(async () => ({ ok: true })),
}));

async function invokeApp(app: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const [pathOnly, rawQuery] = options.url.split("?");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: pathOnly,
      query: rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery).entries()) : {},
      body: options.body ?? {},
      headers: {},
      get(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader(name: string, value: any) {
        this.headers[String(name).toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };
    app.handle(req, res, (error: any) => {
      if (error) reject(error);
      else reject(new Error(`Unhandled request: ${options.method} ${options.url}`));
    });
  });
}

describe("payments route resolution", () => {
  async function buildApp() {
    const paymentsRoutesModule = await import("../paymentsRoutes");
    const { requireAuth } = await import("../../middleware/requireAuth");
    const { requirePermission } = await import("../../middleware/requireAuthz");
    const screeningJobsAdminRoutes = (await import("../screeningJobsAdminRoutes")).default;

    const app = express();
    app.use(express.json());
    app.put(
      "/api/payments/:paymentId",
      routeSource("paymentsRoutes.ts"),
      requireAuth,
      requirePermission("payments.edit"),
      paymentsRoutesModule.handlePaymentEdit
    );
    app.patch(
      "/api/payments/:paymentId",
      routeSource("paymentsRoutes.ts"),
      requireAuth,
      requirePermission("payments.edit"),
      paymentsRoutesModule.handlePaymentEdit
    );
    app.use("/api/payments", routeSource("paymentsRoutes.ts"), paymentsRoutesModule.paymentsEditRouter);
    app.use("/api", routeSource("paymentsRoutes.ts"), paymentsRoutesModule.default);
    app.use("/api/payments", routeSource("paymentsRoutes.ts"), (_req, res) => {
      return res.status(404).json({ ok: false, code: "PAYMENTS_ROUTE_NOT_FOUND", error: "Not Found" });
    });
    app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);
    app.use("/api", (_req, res) => {
      return res.status(404).json({ ok: false, error: "Not Found" });
    });
    return app;
  }

  it("resolves PATCH /api/payments/:id through paymentsRoutes before broad screening routes", async () => {
    const app = await buildApp();

    const res = await invokeApp(app, {
      method: "PATCH",
      url: "/api/payments/not-a-payment-id",
      body: { amount: 1900 },
    });

    expect(res.status).toBe(404);
    expect(res.headers["x-route-source"]).toBe("paymentsRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body).toEqual({ ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment not found" });
  });

  it("resolves PUT /api/payments/:id through paymentsRoutes before broad screening routes", async () => {
    const app = await buildApp();

    const res = await invokeApp(app, {
      method: "PUT",
      url: "/api/payments/not-a-payment-id",
      body: { amount: 1900 },
    });

    expect(res.status).toBe(404);
    expect(res.headers["x-route-source"]).toBe("paymentsRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body).toEqual({ ok: false, code: "PAYMENT_NOT_FOUND", error: "Payment not found" });
  });

  it("keeps unknown /api/payments paths out of screeningJobsAdminRoutes", async () => {
    const app = await buildApp();

    const res = await invokeApp(app, {
      method: "GET",
      url: "/api/payments/not-a-payment-id/extra",
    });

    expect(res.status).toBe(404);
    expect(res.headers["x-route-source"]).toBe("paymentsRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body).toEqual({ ok: false, code: "PAYMENTS_ROUTE_NOT_FOUND", error: "Not Found" });
  });
});
