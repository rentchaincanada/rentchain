import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAuthTokenMock: vi.fn(),
  buildCanonicalSessionUserFromClaimsMock: vi.fn(),
  loadAdminAnalyticsSnapshotMock: vi.fn(),
}));

vi.mock("../../auth/jwt", () => ({
  verifyAuthToken: mocks.verifyAuthTokenMock,
}));

vi.mock("../../services/sessionUserService", () => ({
  buildCanonicalSessionUserFromClaims: mocks.buildCanonicalSessionUserFromClaimsMock,
}));

vi.mock("../../services/admin/adminAnalyticsSnapshot", () => ({
  loadAdminAnalyticsSnapshot: mocks.loadAdminAnalyticsSnapshotMock,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      where: vi.fn(),
      doc: vi.fn(() => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() })),
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

function createReq(headers?: Record<string, string>) {
  return {
    headers: headers || {},
    query: {},
    body: {},
    params: {},
  } as any;
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader: vi.fn(),
  } as any;
}

async function runRoute(router: any, method: "get", path: string, req: any) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  if (!layer) throw new Error(`route not found: ${method.toUpperCase()} ${path}`);
  const res = createRes();
  const stack = [...layer.route.stack];

  async function next(index: number): Promise<void> {
    const item = stack[index];
    if (!item) return;
    await new Promise<void>((resolve, reject) => {
      try {
        let nextCalled = false;
        const maybe = item.handle(req, res, (err?: unknown) => {
          nextCalled = true;
          if (err) reject(err);
          else resolve(next(index + 1));
        });
        if (maybe && typeof maybe.then === "function") {
          maybe.then(() => resolve()).catch(reject);
        } else if (item.handle.length < 3 || !nextCalled) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  await next(0);
  return res;
}

describe("admin analytics snapshot route auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.verifyAuthTokenMock.mockReset();
    mocks.buildCanonicalSessionUserFromClaimsMock.mockReset();
    mocks.loadAdminAnalyticsSnapshotMock.mockReset();
    mocks.loadAdminAnalyticsSnapshotMock.mockResolvedValue({
      summary: {
        applicationsStarted: 0,
        applicationsSubmitted: 0,
        applicationConversionRate: null,
        screeningsPaid: 0,
        screeningRevenueCents: 0,
        openWorkOrders: 0,
        maintenanceCostCents: 0,
        occupiedUnits: 0,
        vacancyRate: null,
      },
      applications: {
        started: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 0,
        conversionRate: null,
      },
      screening: {
        initiated: 0,
        checkoutCreated: 0,
        paid: 0,
        fulfilled: 0,
        blocked: 0,
        expired: 0,
        abandoned: 0,
        needsReview: 0,
        totalRevenueCents: 0,
        averageRevenuePerPaidScreeningCents: null,
        statusCounts: {
          not_started: 0,
          quoted: 0,
          checkout_created: 0,
          payment_pending: 0,
          paid_not_fulfilled: 0,
          fulfilled: 0,
          blocked: 0,
          expired: 0,
          abandoned: 0,
          mismatch: 0,
          duplicate_risk: 0,
          needs_review: 0,
        },
      },
      maintenance: {
        openWorkOrders: 0,
        completedWorkOrders: 0,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 0,
        averageCostPerCompletedWorkOrderCents: null,
        costConcentrationByProperty: [],
      },
      portfolio: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        occupancyRate: null,
        leasesEndingIn30Days: 0,
        leasesEndingIn60Days: 0,
        leasesEndingIn90Days: 0,
        turnoverCount: 0,
      },
      activity: {
        trackedEvents: 0,
        canonicalEvents: 0,
        activeActors: 0,
      },
      filters: {
        period: "30d",
        granularity: "daily",
        from: "2026-03-21T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    const router = (await import("../adminRoutes")).default;
    const res = await runRoute(router, "get", "/analytics/snapshot", createReq());
    expect(res.statusCode).toBe(401);
    expect(mocks.loadAdminAnalyticsSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns 401 for authenticated non-admin requests", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "landlord-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "landlord-1",
      role: "landlord",
      permissions: [],
      revokedPermissions: [],
      entitlements: {},
    });

    const router = (await import("../adminRoutes")).default;
    const res = await runRoute(router, "get", "/analytics/snapshot", createReq({ authorization: "Bearer landlord-token" }));
    expect(res.statusCode).toBe(401);
    expect(mocks.loadAdminAnalyticsSnapshotMock).not.toHaveBeenCalled();
  });
});
