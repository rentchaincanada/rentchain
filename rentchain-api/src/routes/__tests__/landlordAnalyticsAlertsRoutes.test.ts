import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsAlerts = vi.fn();

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

vi.mock("../../services/landlord/landlordAnalyticsAlerts", () => ({
  loadLandlordAnalyticsAlerts,
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

describe("landlordAnalyticsAlertsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordAnalyticsAlerts.mockResolvedValue({
      summary: {
        activeCount: 2,
        highSeverityCount: 1,
        mediumSeverityCount: 1,
        lowSeverityCount: 0,
      },
      alerts: [
        {
          id: "alert-1",
          type: "lease_expiry",
          severity: "medium",
          status: "active",
          title: "Leases ending soon",
          message: "2 leases end within 30 days.",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          period: "30d",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
          actions: [],
        },
      ],
      filters: {
        period: "30d",
        propertyId: null,
        status: "active",
      },
    });
  });

  it("returns landlord-scoped alerts without allowing scope override", async () => {
    const router = (await import("../landlordAnalyticsAlertsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics/alerts?period=30d&status=all&propertyId=prop-1&landlordId=other",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordAnalyticsAlerts).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "30d",
      propertyId: "prop-1",
      status: "all",
    });
    expect(response.body.ok).toBe(true);
  });

  it("enforces landlord authentication", async () => {
    const router = (await import("../landlordAnalyticsAlertsRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics/alerts",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics/alerts",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });
});
