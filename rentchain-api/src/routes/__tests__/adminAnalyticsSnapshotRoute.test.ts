import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminAnalyticsSnapshot = vi.fn();

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/admin/adminAnalyticsSnapshot", () => ({
  loadAdminAnalyticsSnapshot,
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

vi.mock("../../services/statusService", () => ({
  getPublicStatusPayload: vi.fn(async () => ({ ok: true })),
  createStatusIncident: vi.fn(),
  resolveStatusIncident: vi.fn(),
  updateStatusComponent: vi.fn(),
  updateStatusMeta: vi.fn(),
}));

vi.mock("../../services/metrics/tuReferralReport", () => ({
  getTuReferralMetricsForMonth: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/admin/adminSubscriptionConversionView", () => ({
  loadAdminSubscriptionConversionFunnel: vi.fn(),
}));

vi.mock("../../services/admin/adminSubscriptionConversionInsights", () => ({
  loadAdminSubscriptionConversionInsights: vi.fn(),
}));

vi.mock("../../services/admin/adminActivationSummary", () => ({
  loadAdminActivationSummary: vi.fn(),
}));

vi.mock("../../services/admin/adminSubscriptionConversionValidation", () => ({
  loadAdminSubscriptionConversionValidation: vi.fn(),
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

async function invokeRouter(router: any, url: string) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: "GET",
      url: url.replace(/^\/api\/admin/, ""),
      originalUrl: url,
      path: url.replace(/^\/api\/admin/, "").split("?")[0],
      query: {},
      body: {},
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
    const [, rawQuery] = url.split("?");
    if (rawQuery) {
      req.query = Object.fromEntries(new URLSearchParams(rawQuery).entries());
    }
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("GET /api/admin/analytics/snapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    loadAdminAnalyticsSnapshot.mockReset();
  });

  it("returns the admin analytics snapshot payload", async () => {
    loadAdminAnalyticsSnapshot.mockResolvedValue({
      summary: {
        applicationsStarted: 10,
        applicationsSubmitted: 8,
        applicationConversionRate: 0.25,
        screeningsPaid: 3,
        screeningRevenueCents: 12600,
        openWorkOrders: 4,
        maintenanceCostCents: 22000,
        occupiedUnits: 18,
        vacancyRate: 0.1,
      },
      applications: {
        started: 10,
        submitted: 8,
        approved: 2,
        rejected: 1,
        declined: 0,
        pendingReviewCount: 5,
        conversionRate: 0.25,
      },
      screening: {
        initiated: 5,
        checkoutCreated: 4,
        paid: 3,
        fulfilled: 2,
        blocked: 0,
        expired: 1,
        abandoned: 1,
        needsReview: 0,
        totalRevenueCents: 12600,
        averageRevenuePerPaidScreeningCents: 4200,
        statusCounts: {
          not_started: 0,
          quoted: 0,
          checkout_created: 1,
          payment_pending: 0,
          paid_not_fulfilled: 1,
          fulfilled: 2,
          blocked: 0,
          expired: 1,
          abandoned: 1,
          mismatch: 0,
          duplicate_risk: 0,
          needs_review: 0,
        },
      },
      maintenance: {
        openWorkOrders: 4,
        completedWorkOrders: 6,
        reopenedWorkOrders: 1,
        maintenanceCostCents: 22000,
        averageCostPerCompletedWorkOrderCents: 3667,
        costConcentrationByProperty: [],
      },
      portfolio: {
        totalProperties: 4,
        totalUnits: 20,
        occupiedUnits: 18,
        vacantUnits: 2,
        occupancyRate: 0.9,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 2,
        leasesEndingIn90Days: 3,
        turnoverCount: 1,
      },
      activity: {
        trackedEvents: 12,
        canonicalEvents: 7,
        activeActors: 5,
      },
      filters: {
        period: "90d",
        granularity: "weekly",
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, "/api/admin/analytics/snapshot?period=90d&granularity=weekly");

    expect(res.status).toBe(200);
    expect(loadAdminAnalyticsSnapshot).toHaveBeenCalledWith({
      period: "90d",
      granularity: "weekly",
    });
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.applicationsStarted).toBe(10);
    expect(res.body.filters).toEqual({
      period: "90d",
      granularity: "weekly",
      from: "2026-01-20T00:00:00.000Z",
      to: "2026-04-20T00:00:00.000Z",
    });
  });
});
