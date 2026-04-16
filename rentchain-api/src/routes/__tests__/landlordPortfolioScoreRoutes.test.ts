import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordPortfolioHealthInputs = vi.fn();
const derivePortfolioScoreExternal = vi.fn();

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

vi.mock("../../lib/portfolioScoreExternal/derivePortfolioScoreExternal", () => ({
  derivePortfolioScoreExternal,
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

describe("landlordPortfolioScoreRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordPortfolioHealthInputs.mockResolvedValue({
      portfolioId: "landlord-1",
      portfolioScore: {},
      portfolioTrend: {},
    });
    derivePortfolioScoreExternal.mockReturnValue({
      version: "v1",
      portfolioId: "landlord-1",
      generatedAt: "2026-04-16T12:00:00.000Z",
      score: 84,
      grade: "B",
      summary: {
        headline: "Your portfolio is stable with some areas to monitor.",
        explanation: "Your portfolio is performing steadily overall, with a few areas that may benefit from closer follow-through.",
      },
      trend: {
        direction: "stable",
        summary: "Your portfolio score has remained generally steady in recent history.",
      },
      components: [],
      trust: {
        explanation: "Your score reflects how consistently your rental operations are performing over time.",
        methodologyNote: "Scores are based on activity patterns, workflow completion, and operational consistency over time.",
      },
    });
  });

  it("returns landlord-scoped portfolio score", async () => {
    const router = (await import("../landlordPortfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordPortfolioHealthInputs).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.portfolioScore?.portfolioId).toBe("landlord-1");
  });

  it("does not allow arbitrary portfolio lookup from query params", async () => {
    const router = (await import("../landlordPortfolioScoreRoutes")).default;
    await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score?portfolioId=other-landlord",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(loadLandlordPortfolioHealthInputs).toHaveBeenCalledWith("landlord-1");
  });

  it("enforces landlord-authenticated scope", async () => {
    const router = (await import("../landlordPortfolioScoreRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });

  it("returns a stable safe payload shape", async () => {
    const router = (await import("../landlordPortfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.body?.portfolioScore).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        grade: expect.any(String),
        summary: expect.objectContaining({ headline: expect.any(String), explanation: expect.any(String) }),
        trend: expect.objectContaining({ direction: expect.any(String) }),
        components: expect.any(Array),
        trust: expect.objectContaining({ explanation: expect.any(String), methodologyNote: expect.any(String) }),
      })
    );
  });
});
