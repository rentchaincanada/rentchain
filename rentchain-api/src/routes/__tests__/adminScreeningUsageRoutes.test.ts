import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAuthTokenMock: vi.fn(),
  buildCanonicalSessionUserFromClaimsMock: vi.fn(),
  loadTransUnionUsageReportMock: vi.fn(),
}));

vi.mock("../../auth/jwt", () => ({
  verifyAuthToken: mocks.verifyAuthTokenMock,
}));

vi.mock("../../services/sessionUserService", () => ({
  buildCanonicalSessionUserFromClaims: mocks.buildCanonicalSessionUserFromClaimsMock,
}));

vi.mock("../../services/screening/transUnionUsageReportService", () => ({
  loadTransUnionUsageReport: mocks.loadTransUnionUsageReportMock,
}));

function createReq(headers?: Record<string, string>, query?: Record<string, unknown>) {
  return {
    headers: headers || {},
    query: query || {},
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
    setHeader: vi.fn(),
  } as any;
}

async function runRoute(router: any, req: any) {
  const layer = router.stack.find((entry: any) => entry.route?.path === "/screening/transunion-usage");
  if (!layer) throw new Error("route not found");
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

describe("adminScreeningUsageRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.verifyAuthTokenMock.mockReset();
    mocks.buildCanonicalSessionUserFromClaimsMock.mockReset();
    mocks.loadTransUnionUsageReportMock.mockReset();
    mocks.loadTransUnionUsageReportMock.mockResolvedValue({
      ok: true,
      providerKey: "transunion",
      period: {
        label: "last_30_days",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-30T23:59:59.999Z",
      },
      funnel: {},
      usage: {},
      compliance: {},
      quality: {},
      report: {},
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    const router = (await import("../adminScreeningUsageRoutes")).default;
    const res = await runRoute(router, createReq());
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for authenticated non-admin requests", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "landlord-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "landlord-1",
      role: "landlord",
      permissions: [],
      revokedPermissions: [],
    });
    const router = (await import("../adminScreeningUsageRoutes")).default;
    const res = await runRoute(router, createReq({ authorization: "Bearer landlord-token" }));
    expect(res.statusCode).toBe(403);
  });

  it("allows admins to access the report with period filters", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "admin-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      permissions: ["system.admin"],
      revokedPermissions: [],
    });
    const router = (await import("../adminScreeningUsageRoutes")).default;
    const res = await runRoute(
      router,
      createReq({ authorization: "Bearer admin-token" }, { period: "last_60_days" })
    );
    expect(res.statusCode).toBe(200);
    expect(mocks.loadTransUnionUsageReportMock).toHaveBeenCalledWith({
      period: "last_60_days",
      startDate: null,
      endDate: null,
    });
  });
});
