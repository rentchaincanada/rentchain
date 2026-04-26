import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPortfolioScoreShareState = vi.fn();
const savePortfolioScoreShareState = vi.fn();
const rotatePortfolioScoreShareToken = vi.fn();
const revokePortfolioScoreSharing = vi.fn();

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

vi.mock("../../lib/portfolioScoreSharing/loadPortfolioScoreShareState", () => ({
  loadPortfolioScoreShareState,
}));

vi.mock("../../lib/portfolioScoreSharing/savePortfolioScoreShareState", () => ({
  savePortfolioScoreShareState,
}));

vi.mock("../../lib/portfolioScoreSharing/rotatePortfolioScoreShareToken", () => ({
  buildPortfolioScoreSharePath: (token: string) => `/portfolio-score/shared/${token}`,
  rotatePortfolioScoreShareToken,
  revokePortfolioScoreSharing,
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path] = options.url.split("?");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: {},
      params: {},
      body: options.body || {},
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

describe("landlordPortfolioScoreSharingRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPortfolioScoreShareState.mockResolvedValue({
      version: "v1",
      portfolioId: "landlord-1",
      visibility: "private",
      shareToken: null,
      shareEnabledAt: null,
      revokedAt: null,
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
    savePortfolioScoreShareState.mockResolvedValue({
      version: "v1",
      portfolioId: "landlord-1",
      visibility: "shareable_link",
      shareToken: "token-1",
      shareEnabledAt: "2026-04-16T12:00:00.000Z",
      revokedAt: null,
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
    rotatePortfolioScoreShareToken.mockResolvedValue({
      version: "v1",
      portfolioId: "landlord-1",
      visibility: "shareable_link",
      shareToken: "token-2",
      shareEnabledAt: "2026-04-16T12:00:00.000Z",
      revokedAt: null,
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
    revokePortfolioScoreSharing.mockResolvedValue({
      version: "v1",
      portfolioId: "landlord-1",
      visibility: "private",
      shareToken: null,
      shareEnabledAt: "2026-04-16T12:00:00.000Z",
      revokedAt: "2026-04-16T13:00:00.000Z",
      updatedAt: "2026-04-16T13:00:00.000Z",
    });
  });

  it("returns the default private sharing state", async () => {
    const router = (await import("../landlordPortfolioScoreSharingRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score-sharing",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadPortfolioScoreShareState).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.sharing?.visibility).toBe("private");
    expect(response.body?.shareUrl).toBeNull();
  });

  it("enables shareable link mode and returns a share url", async () => {
    const router = (await import("../landlordPortfolioScoreSharingRoutes")).default;
    const response = await invokeRouter(router, {
      method: "PATCH",
      url: "/landlord/portfolio-score-sharing",
      user: { id: "landlord-1", role: "landlord" },
      body: { visibility: "shareable_link" },
    });

    expect(response.status).toBe(200);
    expect(rotatePortfolioScoreShareToken).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.shareUrl).toBe("/portfolio-score/shared/token-2");
  });

  it("revokes sharing when switching back to private", async () => {
    const router = (await import("../landlordPortfolioScoreSharingRoutes")).default;
    const response = await invokeRouter(router, {
      method: "PATCH",
      url: "/landlord/portfolio-score-sharing",
      user: { id: "landlord-1", role: "landlord" },
      body: { visibility: "private" },
    });

    expect(response.status).toBe(200);
    expect(revokePortfolioScoreSharing).toHaveBeenCalledWith("landlord-1", "private");
    expect(response.body?.sharing?.visibility).toBe("private");
  });

  it("rotates tokens explicitly", async () => {
    const router = (await import("../landlordPortfolioScoreSharingRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/portfolio-score-sharing/rotate",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(rotatePortfolioScoreShareToken).toHaveBeenCalledWith("landlord-1");
    expect(response.body?.shareUrl).toContain("token-2");
  });

  it("enforces landlord-scoped auth", async () => {
    const router = (await import("../landlordPortfolioScoreSharingRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score-sharing",
      user: { id: "tenant-1", role: "tenant" },
    });
    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-score-sharing",
      user: null,
    });

    expect(forbidden.status).toBe(403);
    expect(unauthorized.status).toBe(401);
  });
});
