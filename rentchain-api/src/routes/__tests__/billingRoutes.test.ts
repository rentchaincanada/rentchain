import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveLandlordAndTierMock = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

vi.mock("../../lib/landlordResolver", () => ({
  resolveLandlordAndTier: resolveLandlordAndTierMock,
}));

vi.mock("../../services/billingService", () => ({
  listRecordsForLandlord: vi.fn(() => []),
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => null }),
        set: async () => undefined,
      }),
    }),
  },
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: vi.fn(() => {
    throw new Error("not needed in billingRoutes subscription-status test");
  }),
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: vi.fn(() => ({ ok: false, error: "stripe_not_configured" })),
  isStripeNotConfiguredError: vi.fn(() => false),
}));

vi.mock("../../config/screeningConfig", () => ({
  FRONTEND_URL: "http://localhost:5173",
}));

vi.mock("../../billing/screeningPricing", () => ({
  getScreeningPricing: vi.fn(() => ({
    baseAmountCents: 2500,
    scoreAddOnCents: 500,
    expeditedAddOnCents: 700,
  })),
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; headers?: Record<string, string> }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      headers: options.headers ?? {},
      body: {},
      query: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
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

describe("billingRoutes subscription status", () => {
  beforeEach(() => {
    resolveLandlordAndTierMock.mockReset();
  });

  it("returns the effective canonical tier from landlord resolution", async () => {
    resolveLandlordAndTierMock.mockResolvedValue({
      tier: "elite",
      landlordIdResolved: "landlord-1",
      landlordDocId: "landlord-1",
      landlordPlanRaw: "enterprise",
      source: "landlordId",
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "starter" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      tier: "elite",
      planId: "elite",
      status: "active",
      isActive: true,
      interval: null,
      renewalDate: null,
    });
  });

  it("keeps the compatibility alias route and falls back to the token plan when needed", async () => {
    resolveLandlordAndTierMock.mockResolvedValue({
      tier: undefined,
      landlordIdResolved: "landlord-1",
      landlordDocId: null,
      landlordPlanRaw: null,
      source: "tokenFallback",
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/billing/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "business" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      tier: "elite",
      planId: "elite",
      status: "active",
      isActive: true,
    });
  });
});
