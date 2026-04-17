import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminSubscriptionConversionFunnel = vi.fn();

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/admin/adminSubscriptionConversionView", () => ({
  loadAdminSubscriptionConversionFunnel,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      where: vi.fn(),
      doc: vi.fn(() => ({ set: vi.fn() })),
    })),
  },
}));

vi.mock("../../services/telemetryService", () => ({
  getCountersSummary: vi.fn(async () => ({ byName: {} })),
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => false,
  getStripeClient: () => {
    throw new Error("not configured");
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({ createUser: vi.fn() }),
    firestore: {
      FieldValue: {
        serverTimestamp: () => Date.now(),
      },
    },
  },
}));

async function createRouter() {
  return (await import("../adminRoutes")).default;
}

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    body?: any;
  }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url.replace(/^\/api\/admin/, ""),
      originalUrl: options.url,
      path: options.url.replace(/^\/api\/admin/, "").split("?")[0],
      query: {},
      body: options.body ?? {},
      user: { id: "admin-1", role: "admin" },
      cookies: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader(name: string, value: any) {
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
    const [, rawQuery] = options.url.split("?");
    if (rawQuery) {
      req.query = Object.fromEntries(new URLSearchParams(rawQuery).entries());
    }
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("GET /api/admin/analytics/conversion-funnel", () => {
  beforeEach(() => {
    vi.resetModules();
    loadAdminSubscriptionConversionFunnel.mockReset();
  });

  it("returns the admin conversion funnel payload", async () => {
    loadAdminSubscriptionConversionFunnel.mockResolvedValue({
      window: { days: 30, from: "2026-03-18T00:00:00.000Z", to: "2026-04-17T00:00:00.000Z" },
      funnel: [{ step: "pricing_page_viewed", count: 12 }],
      breakdowns: {
        targetPlan: { pro: 5 },
        surface: { pricing_page: 12 },
        source: { marketing_pricing: 7 },
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/api/admin/analytics/conversion-funnel?days=30",
    });

    expect(res.status).toBe(200);
    expect(loadAdminSubscriptionConversionFunnel).toHaveBeenCalledWith({ days: "30" });
    expect(res.body).toEqual({
      ok: true,
      window: { days: 30, from: "2026-03-18T00:00:00.000Z", to: "2026-04-17T00:00:00.000Z" },
      funnel: [{ step: "pricing_page_viewed", count: 12 }],
      breakdowns: {
        targetPlan: { pro: 5 },
        surface: { pricing_page: 12 },
        source: { marketing_pricing: 7 },
      },
    });
  });
});
