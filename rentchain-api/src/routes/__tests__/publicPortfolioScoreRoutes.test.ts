import { beforeEach, describe, expect, it, vi } from "vitest";

const whereMock = vi.fn();
const limitMock = vi.fn();
const getMock = vi.fn();
const loadLandlordPortfolioHealthInputs = vi.fn();
const derivePortfolioScoreExternal = vi.fn();

vi.mock("../../firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      where: whereMock,
    })),
  },
}));

vi.mock("../../lib/portfolioHealth/loadLandlordPortfolioHealthInputs", () => ({
  loadLandlordPortfolioHealthInputs,
}));

vi.mock("../../lib/portfolioScoreExternal/derivePortfolioScoreExternal", () => ({
  derivePortfolioScoreExternal,
}));

async function invokeRouter(router: any, options: { method: string; url: string }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const path = options.url;
    const token = path.split("/").pop() || "";
    const req: any = {
      method: options.method,
      url: path,
      originalUrl: path,
      path,
      params: { token },
      query: {},
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

describe("publicPortfolioScoreRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereMock.mockReturnValue({ where: whereMock, limit: limitMock });
    limitMock.mockReturnValue({ get: getMock });
    getMock.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            portfolioId: "landlord-1",
            visibility: "shareable_link",
            shareToken: "token-1",
            revokedAt: null,
          }),
        },
      ],
    });
    loadLandlordPortfolioHealthInputs.mockResolvedValue({
      portfolioId: "landlord-1",
      portfolioScore: {},
      portfolioTrend: {},
    });
    derivePortfolioScoreExternal.mockReturnValue({
      version: "v1",
      portfolioId: "landlord-1",
      generatedAt: "2026-04-16T12:00:00.000Z",
      score: 81,
      grade: "B",
      summary: {
        headline: "Your portfolio is stable with some areas to monitor.",
        explanation: "Operations are performing steadily overall.",
      },
      trend: {
        direction: "stable",
        summary: "The portfolio score has remained generally steady.",
      },
      components: [],
      trust: {
        explanation: "The score reflects operational consistency over time.",
        methodologyNote: "Scores are based on activity patterns and consistency.",
      },
    });
  });

  it("returns a safe shared payload for an active token", async () => {
    const router = (await import("../publicPortfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/shared/token-1",
    });

    expect(response.status).toBe(200);
    expect(loadLandlordPortfolioHealthInputs).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.portfolioScore).toEqual(
      expect.objectContaining({
        score: 81,
        grade: "B",
        summary: expect.objectContaining({ headline: expect.any(String) }),
        components: expect.any(Array),
      })
    );
  });

  it("returns a safe not found response for invalid tokens", async () => {
    getMock.mockResolvedValueOnce({ empty: true, docs: [] });
    const router = (await import("../publicPortfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/shared/missing-token",
    });

    expect(response.status).toBe(404);
    expect(response.body?.error).toBe("NOT_FOUND");
  });

  it("blocks revoked sharing state", async () => {
    getMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            portfolioId: "landlord-1",
            visibility: "shareable_link",
            shareToken: "token-1",
            revokedAt: "2026-04-16T13:00:00.000Z",
          }),
        },
      ],
    });
    const router = (await import("../publicPortfolioScoreRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/portfolio-score/shared/token-1",
    });

    expect(response.status).toBe(404);
    expect(response.body?.error).toBe("NOT_FOUND");
  });
});
