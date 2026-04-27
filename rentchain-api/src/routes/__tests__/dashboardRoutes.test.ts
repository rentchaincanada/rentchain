import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const computePortfolioCredibilitySummaryMock = vi.fn();
const resolveLandlordAndTierMock = vi.fn();

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function makeDocs(name: string, filters: Array<{ field: string; value: any }>) {
    return Array.from(ensureCollection(name).entries())
      .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
      .map(([id, data]) => ({ id, data: () => data }));
  }

  function makeQuery(name: string, filters: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) => makeQuery(name, [...filters, { field, value }]),
      limit: () => makeQuery(name, filters),
      get: async () => {
        const docs = makeDocs(name, filters);
        return {
          docs,
          empty: docs.length === 0,
          size: docs.length,
          forEach: (fn: any) => docs.forEach(fn),
        };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, data),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, value }]),
        limit: () => makeQuery(name),
        get: async () => makeQuery(name).get(),
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../lib/landlordResolver", () => ({
  resolveLandlordAndTier: resolveLandlordAndTierMock,
}));

vi.mock("../../services/leaseNoticeWorkflowService", () => ({
  computeNoResponseState: vi.fn(() => false),
  normalizeLeaseRecord: vi.fn((id: string, raw: any) => ({ id, ...raw })),
}));

vi.mock("../../services/risk/portfolioCredibilitySummary", () => ({
  computePortfolioCredibilitySummary: computePortfolioCredibilitySummaryMock,
}));

describe("dashboardRoutes GET /summary", () => {
  beforeEach(() => {
    resetFakeDb();
    computePortfolioCredibilitySummaryMock.mockReset();
    resolveLandlordAndTierMock.mockReset();
    resolveLandlordAndTierMock.mockResolvedValue({ tier: "pro" });
    computePortfolioCredibilitySummaryMock.mockImplementation(({ leases }: any) => ({
      propertyCount: 1,
      activeLeaseCount: Array.isArray(leases) ? leases.length : 0,
      tenantScoreAverage: null,
      tenantScoreGradeAverage: null,
      leaseRiskAverage: null,
      leaseRiskGradeAverage: null,
      tenantsWithScoreCount: 0,
      leasesWithRiskCount: 0,
      lowConfidenceCount: 0,
      missingCredibilityCount: 0,
      healthStatus: "unknown",
    }));
  });

  async function makeApp() {
    const router = (await import("../dashboardRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/dashboard", router);
    return app;
  }

  async function invokeSummary(app: express.Express) {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req: any = {
        method: "GET",
        url: "/api/dashboard/summary",
        originalUrl: "/api/dashboard/summary",
        path: "/api/dashboard/summary",
        headers: {},
        body: {},
        query: {},
        params: {},
      };
      const res: any = {
        statusCode: 200,
        setHeader: vi.fn(),
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };
      app.handle(req, res, (error: any) => {
        if (error) reject(error);
      });
    });
  }

  it("counts only active-property tenants and visible live leases", async () => {
    seedDoc("properties", "prop-active", {
      landlordId: "landlord-1",
      portfolioStatus: "active",
      units: [{ id: "unit-1" }],
    });
    seedDoc("properties", "prop-archived", {
      landlordId: "landlord-1",
      portfolioStatus: "archived",
      units: [{ id: "unit-2" }],
    });
    seedDoc("tenants", "tenant-active", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      hiddenFromActiveLists: false,
    });
    seedDoc("tenants", "tenant-archived", {
      landlordId: "landlord-1",
      propertyId: "prop-archived",
      hiddenFromActiveLists: false,
    });
    seedDoc("tenants", "tenant-hidden", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      hiddenFromActiveLists: true,
    });
    seedDoc("leases", "lease-visible", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      tenantId: "tenant-active",
      status: "active",
    });
    seedDoc("leases", "lease-hidden", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      tenantId: "tenant-active",
      status: "active",
      hiddenFromActiveLists: true,
    });
    seedDoc("leases", "test_lease_quit_01", {
      landlordId: "landlord-1",
      propertyId: "prop-active",
      tenantId: "tenant-active",
      status: "active",
    });

    const app = await makeApp();
    const response = await invokeSummary(app);

    expect(response.status).toBe(200);
    expect(response.body?.data?.kpis?.tenantsCount).toBe(1);
    expect(response.body?.data?.portfolioCredibilitySummary?.activeLeaseCount).toBe(1);
    expect(computePortfolioCredibilitySummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leases: [expect.objectContaining({ id: "lease-visible" })],
      })
    );
  });
});
