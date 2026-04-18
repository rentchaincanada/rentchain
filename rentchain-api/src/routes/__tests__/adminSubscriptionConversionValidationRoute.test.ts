import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminSubscriptionConversionFunnel = vi.fn();
const loadAdminSubscriptionConversionInsights = vi.fn();
const loadAdminSubscriptionConversionValidation = vi.fn();

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/admin/adminSubscriptionConversionView", () => ({
  loadAdminSubscriptionConversionFunnel,
}));

vi.mock("../../services/admin/adminSubscriptionConversionInsights", () => ({
  loadAdminSubscriptionConversionInsights,
}));

vi.mock("../../services/admin/adminSubscriptionConversionValidation", () => ({
  loadAdminSubscriptionConversionValidation,
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

describe("GET /api/admin/analytics/conversion-validation", () => {
  beforeEach(() => {
    vi.resetModules();
    loadAdminSubscriptionConversionFunnel.mockReset();
    loadAdminSubscriptionConversionInsights.mockReset();
    loadAdminSubscriptionConversionValidation.mockReset();
  });

  it("returns the admin conversion validation payload", async () => {
    loadAdminSubscriptionConversionValidation.mockResolvedValue({
      window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
      segmentation: {
        strategy: "heuristic_actor_pattern_v1",
        buckets: {
          all_activity: { description: "All Mission 29-style conversion events in the bounded window." },
          likely_internal_or_test: { description: "Testing-like activity." },
          likely_external_or_real: { description: "Directional external activity." },
        },
        caveats: ["Heuristic only."],
      },
      segments: {
        all_activity: {
          window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
          eventCount: 12,
          actorCount: 2,
          funnel: [{ step: "pricing_page_viewed", count: 2 }],
          breakdowns: {
            targetPlan: { starter: 2 },
            surface: { billing_page: 2 },
            source: { billing_page: 2 },
          },
          insights: {
            strongestSurface: { surface: "billing_page", count: 2 },
            strongestPlanInterest: { targetPlan: "starter", count: 2 },
            weakestFunnelStep: { step: "pricing_page_viewed -> pricing_plan_cta_clicked", conversion: 0.5 },
            strongestFeatureSignal: null,
            promptViewCount: 0,
          },
        },
        likely_internal_or_test: {
          window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
          eventCount: 8,
          actorCount: 1,
          funnel: [{ step: "pricing_page_viewed", count: 1 }],
          breakdowns: {
            targetPlan: { elite: 3 },
            surface: { locked_feature: 3 },
            source: { applications_page: 3 },
          },
          insights: {
            strongestSurface: { surface: "locked_feature", count: 2 },
            strongestPlanInterest: { targetPlan: "elite", count: 3 },
            weakestFunnelStep: { step: "billing_page_opened -> billing_upgrade_clicked", conversion: 0.5 },
            strongestFeatureSignal: null,
            promptViewCount: 1,
          },
        },
        likely_external_or_real: {
          window: { days: 30, from: "2026-03-19T00:00:00.000Z", to: "2026-04-18T00:00:00.000Z" },
          eventCount: 4,
          actorCount: 1,
          funnel: [{ step: "pricing_page_viewed", count: 1 }],
          breakdowns: {
            targetPlan: { starter: 2 },
            surface: { billing_page: 2 },
            source: { billing_page: 2 },
          },
          insights: {
            strongestSurface: { surface: "billing_page", count: 1 },
            strongestPlanInterest: { targetPlan: "starter", count: 2 },
            weakestFunnelStep: { step: "pricing_page_viewed -> pricing_plan_cta_clicked", conversion: 1 },
            strongestFeatureSignal: null,
            promptViewCount: 0,
          },
        },
      },
      comparisons: {
        dominantSegment: { segment: "likely_internal_or_test", eventCount: 8 },
        strongestSurfaceAlignment: {
          allActivity: "billing_page",
          likelyInternalOrTest: "locked_feature",
          likelyExternalOrReal: "billing_page",
        },
      },
      recommendations: ["Current funnel activity is dominated by likely internal or controlled testing traffic."],
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/api/admin/analytics/conversion-validation?days=30",
    });

    expect(res.status).toBe(200);
    expect(loadAdminSubscriptionConversionValidation).toHaveBeenCalledWith({ days: "30" });
    expect(res.body.ok).toBe(true);
    expect(res.body.comparisons).toEqual({
      dominantSegment: { segment: "likely_internal_or_test", eventCount: 8 },
      strongestSurfaceAlignment: {
        allActivity: "billing_page",
        likelyInternalOrTest: "locked_feature",
        likelyExternalOrReal: "billing_page",
      },
    });
    expect(res.body.recommendations).toEqual([
      "Current funnel activity is dominated by likely internal or controlled testing traffic.",
    ]);
  });
});
