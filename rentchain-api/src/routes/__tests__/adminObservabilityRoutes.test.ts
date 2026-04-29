import { beforeEach, describe, expect, it, vi } from "vitest";

const deriveSummaryMock = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../services/observability/deriveSystemObservabilitySummary", () => ({
  deriveSystemObservabilitySummary: deriveSummaryMock,
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: any }) {
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
      setHeader() {},
    };
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

describe("adminObservabilityRoutes", () => {
  beforeEach(() => {
    deriveSummaryMock.mockReset();
  });

  it("requires admin permission and returns aggregate-only summary output", async () => {
    deriveSummaryMock.mockResolvedValue({
      generatedAt: "2026-04-28T18:00:00.000Z",
      totals: {
        openCritical: 1,
        openWarnings: 2,
        resolvedLast7Days: 3,
      },
      workflows: [
        {
          workflow: "payment",
          openCritical: 0,
          openWarnings: 1,
          recentCompleted: 2,
          health: "watch",
        },
      ],
      topIssues: [
        {
          title: "Rent payment failed",
          workflow: "payment",
          severity: "warning",
          count: 2,
          lastSeenAt: "2026-04-28T12:00:00.000Z",
        },
      ],
    });

    const router = (await import("../adminObservabilityRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/observability/summary",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const ok = await invokeRouter(router, {
      method: "GET",
      url: "/observability/summary?period=30d",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(ok.status).toBe(200);
    expect(deriveSummaryMock).toHaveBeenCalledWith({ period: "30d" });
    expect(ok.body.ok).toBe(true);
    expect(ok.body.summary).toEqual(
      expect.objectContaining({
        generatedAt: "2026-04-28T18:00:00.000Z",
        totals: {
          openCritical: 1,
          openWarnings: 2,
          resolvedLast7Days: 3,
        },
      })
    );
    expect(JSON.stringify(ok.body)).not.toContain("resourceId");
    expect(JSON.stringify(ok.body)).not.toContain("safeContext");
  });
});
