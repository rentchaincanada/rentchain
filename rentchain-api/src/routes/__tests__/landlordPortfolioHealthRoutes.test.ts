import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordPortfolioHealthInputs = vi.fn();
const deriveLandlordPortfolioHealthSummary = vi.fn();

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

vi.mock("../../lib/portfolioHealth/loadLandlordPortfolioHealthInputs", () => ({
  loadLandlordPortfolioHealthInputs,
}));

vi.mock("../../lib/portfolioHealth/deriveLandlordPortfolioHealthSummary", () => ({
  deriveLandlordPortfolioHealthSummary,
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

describe("landlordPortfolioHealthRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordPortfolioHealthInputs.mockResolvedValue({
      portfolioId: "landlord-1",
      portfolioScore: {},
      portfolioTrend: {},
    });
    deriveLandlordPortfolioHealthSummary.mockReturnValue({
      version: "v1",
      portfolioId: "landlord-1",
      generatedAt: "2026-04-16T12:00:00.000Z",
      overall: {
        status: "watch",
        headline: "Your portfolio health is stable overall, with a few areas to monitor.",
        summary: "Most portfolio activity is progressing normally, while a small number of areas may need closer follow-through.",
      },
      trend: {
        direction: "stable",
        summary: "Portfolio health has remained generally steady in recent history.",
      },
      dimensions: [],
      nextFocus: [],
      metadata: {
        portfolioScoreGrade: null,
        portfolioScoreAvailable: true,
        trendAvailable: true,
      },
    });
  });

  it("returns landlord-scoped portfolio health", async () => {
    const router = (await import("../landlordPortfolioHealthRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-health",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordPortfolioHealthInputs).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.portfolioHealth?.portfolioId).toBe("landlord-1");
  });

  it("does not allow arbitrary portfolio lookup from query params", async () => {
    const router = (await import("../landlordPortfolioHealthRoutes")).default;
    await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-health?portfolioId=other-landlord",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(loadLandlordPortfolioHealthInputs).toHaveBeenCalledWith("landlord-1");
  });

  it("enforces landlord-authenticated scope", async () => {
    const router = (await import("../landlordPortfolioHealthRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-health",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-health",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });

  it("returns a stable payload shape even when sparse inputs are present", async () => {
    const router = (await import("../landlordPortfolioHealthRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-health",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.body?.portfolioHealth).toEqual(
      expect.objectContaining({
        overall: expect.objectContaining({ status: expect.any(String) }),
        trend: expect.objectContaining({ direction: expect.any(String) }),
        dimensions: expect.any(Array),
        nextFocus: expect.any(Array),
      })
    );
  });
});
