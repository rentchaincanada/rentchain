import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "Missing landlord context" });
    }
    req.user.landlordId = landlordId;
    return next();
  },
}));

vi.mock("../../services/landlord/landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
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

describe("landlordAnalyticsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      summary: {
        occupiedUnits: 4,
        vacancyRate: 0.2,
        activeApplications: 2,
        applicationConversionRate: 0.25,
        openWorkOrders: 1,
        maintenanceCostCents: 8200,
        estimatedScheduledRentCents: 660000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 3,
        submitted: 2,
        approved: 1,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 2,
        conversionRate: 0.5,
      },
      leasing: {
        totalProperties: 2,
        totalUnits: 5,
        occupiedUnits: 4,
        vacantUnits: 1,
        occupancyRate: 0.8,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 1,
        leasesEndingIn90Days: 1,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 1,
        completedWorkOrders: 1,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 8200,
        averageCostPerCompletedWorkOrderCents: 8200,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 660000,
        averageRentPerOccupiedUnitCents: 165000,
      },
      insights: [],
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 3,
            vacancyRate: 0.3,
            activeApplications: 1,
            applicationConversionRate: 0.2,
            openWorkOrders: 2,
            maintenanceCostCents: 4000,
            estimatedScheduledRentCents: 620000,
            leasesEndingSoon: 2,
          },
          applications: {
            started: 2,
            submitted: 2,
            approved: 1,
            rejected: 0,
            declined: 0,
            pendingReviewCount: 1,
            conversionRate: 0.2,
          },
          leasing: {
            totalProperties: 2,
            totalUnits: 5,
            occupiedUnits: 3,
            vacantUnits: 2,
            occupancyRate: 0.6,
            leasesEndingIn30Days: 2,
            leasesEndingIn60Days: 2,
            leasesEndingIn90Days: 2,
            turnoverCount: 0,
          },
          maintenance: {
            openWorkOrders: 2,
            completedWorkOrders: 1,
            reopenedWorkOrders: 0,
            maintenanceCostCents: 4000,
            averageCostPerCompletedWorkOrderCents: 4000,
            costConcentrationByProperty: [],
          },
          revenue: {
            estimatedScheduledRentCents: 620000,
            averageRentPerOccupiedUnitCents: 155000,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
          },
          applications: {},
          leasing: {},
          maintenance: {},
          revenue: {},
        },
      },
      properties: [{ id: "prop-123", name: "Alpha" }],
      propertyMetrics: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });
  });

  it("returns landlord-scoped analytics without allowing scope override", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics?period=90d&propertyId=prop-123&landlordId=other-landlord",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-123",
    });
    expect(response.body.ok).toBe(true);
    expect(response.body.summary.occupiedUnits).toBe(4);
    expect(response.body.comparisons.deltas.summary.occupiedUnits.direction).toBe("better");
  });

  it("enforces landlord authentication", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });
});
