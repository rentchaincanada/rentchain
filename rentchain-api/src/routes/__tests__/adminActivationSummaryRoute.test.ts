import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminActivationSummary = vi.fn();

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/admin/adminActivationSummary", () => ({
  loadAdminActivationSummary,
}));

vi.mock("../../firebase", () => ({
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

describe("GET /api/admin/analytics/activation-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    loadAdminActivationSummary.mockReset();
  });

  it("returns the admin activation summary payload", async () => {
    loadAdminActivationSummary.mockResolvedValue({
      window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
      activationEvents: {
        property_created: 5,
        unit_created: 3,
        tenant_added: 2,
        work_order_created: 1,
      },
      activatedUsers: 6,
      activationRateEstimate: 0.4,
      breakdowns: {
        byEventName: { activation_property_created: 5 },
        byPlan: { free: 4, starter: 2 },
        bySurface: { properties_page: 5 },
      },
      insights: {
        mostCommonActivationEvent: { eventName: "activation_property_created", count: 5 },
        planSeeingActivation: { plan: "free", count: 4 },
        activationOccurring: true,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/api/admin/analytics/activation-summary?days=30",
    });

    expect(res.status).toBe(200);
    expect(loadAdminActivationSummary).toHaveBeenCalledWith({ days: "30" });
    expect(res.body).toEqual({
      ok: true,
      window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
      activationEvents: {
        property_created: 5,
        unit_created: 3,
        tenant_added: 2,
        work_order_created: 1,
      },
      activatedUsers: 6,
      activationRateEstimate: 0.4,
      breakdowns: {
        byEventName: { activation_property_created: 5 },
        byPlan: { free: 4, starter: 2 },
        bySurface: { properties_page: 5 },
      },
      insights: {
        mostCommonActivationEvent: { eventName: "activation_property_created", count: 5 },
        planSeeingActivation: { plan: "free", count: 4 },
        activationOccurring: true,
      },
    });
  });
});
