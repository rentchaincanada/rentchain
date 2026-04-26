import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordActionRecommendationInputs = vi.fn();
const deriveLandlordActionRecommendations = vi.fn();

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

vi.mock("../../lib/actionRecommendations/loadLandlordActionRecommendationInputs", () => ({
  loadLandlordActionRecommendationInputs,
}));

vi.mock("../../lib/actionRecommendations/deriveLandlordActionRecommendations", () => ({
  deriveLandlordActionRecommendations,
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

describe("landlordActionRecommendationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordActionRecommendationInputs.mockResolvedValue({
      portfolioId: "landlord-1",
      portfolioHealth: {},
      portfolioScore: {},
    });
    deriveLandlordActionRecommendations.mockReturnValue([
      {
        version: "v1",
        id: "portfolio-health",
        category: "portfolio_health",
        priority: "medium",
        title: "Monitor portfolio health closely",
        summary: "Your portfolio is generally steady, with a few areas worth watching.",
        whyNow: "A steady review rhythm helps keep your portfolio moving smoothly.",
        suggestedAction: "Check your portfolio health summary this week.",
      },
    ]);
  });

  it("returns landlord-scoped recommendations", async () => {
    const router = (await import("../landlordActionRecommendationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/action-recommendations",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordActionRecommendationInputs).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.recommendations).toHaveLength(1);
  });

  it("does not allow arbitrary portfolio lookup from query params", async () => {
    const router = (await import("../landlordActionRecommendationRoutes")).default;
    await invokeRouter(router, {
      method: "GET",
      url: "/landlord/action-recommendations?portfolioId=other-landlord",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(loadLandlordActionRecommendationInputs).toHaveBeenCalledWith("landlord-1");
  });

  it("enforces landlord-authenticated scope", async () => {
    const router = (await import("../landlordActionRecommendationRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/action-recommendations",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/action-recommendations",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });

  it("returns a stable null-safe response shape", async () => {
    const router = (await import("../landlordActionRecommendationRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/action-recommendations",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.body).toEqual({
      recommendations: expect.any(Array),
    });
  });
});
