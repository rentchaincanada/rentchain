import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordPortfolioStatusFinancialInput = vi.fn();

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

vi.mock("../../services/landlordPortfolioStatusFinancial/loadLandlordPortfolioStatusFinancialInput", () => ({
  loadLandlordPortfolioStatusFinancialInput,
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

describe("landlordPortfolioStatusFinancialRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordPortfolioStatusFinancialInput.mockResolvedValue({
      landlordId: "landlord-1",
      generatedAt: "2026-06-19T12:00:00.000Z",
      periodMonth: "2026-06",
      properties: [{ id: "property-1", landlordId: "landlord-1" }],
      units: [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1", status: "vacant" }],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          unitId: "unit-1",
          status: "active",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          monthlyRentCents: 120000,
        },
      ],
      tenants: [{ id: "tenant-1", landlordId: "landlord-1", propertyId: "property-1", currentLeaseId: "lease-1" }],
      rentPayments: [
        {
          id: "payment-1",
          landlordId: "landlord-1",
          propertyId: "property-1",
          leaseId: "lease-1",
          amountCents: 120000,
          paidAt: "2026-06-03T12:00:00.000Z",
          status: "paid",
        },
      ],
      ledgerEntries: null,
      ledgerEvents: null,
      payments: null,
    });
  });

  it("returns landlord-scoped portfolio status and financial summary", async () => {
    const router = (await import("../landlordPortfolioStatusFinancialRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-status-financial?periodMonth=2026-06",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
      "confidence",
      "dataQualityFlags",
      "financialSnapshot",
      "generatedAt",
      "landlordId",
      "ok",
      "portfolioStatus",
      "version",
    ]);
    expect(response.body.ok).toBe(true);
    expect(response.body.version).toBe("landlord_portfolio_status_financial_v1");
    expect(response.body.landlordId).toBe("landlord-1");
    expect(response.body.generatedAt).toBe("2026-06-19T12:00:00.000Z");
    expect(response.body.portfolioStatus).toEqual(
      expect.objectContaining({
        totalProperties: 1,
        totalUnits: 1,
        occupiedUnits: 1,
        reviewRequiredUnits: 1,
      })
    );
    expect(response.body.financialSnapshot).toEqual(
      expect.objectContaining({
        expectedMonthlyRentCents: 120000,
        collectedCurrentMonthCents: 120000,
        outstandingCurrentMonthCents: 0,
      })
    );
    expect(response.body.confidence).toEqual(
      expect.objectContaining({
        occupancy: expect.any(String),
        financial: expect.any(String),
      })
    );
    expect(response.body.dataQualityFlags).toContain("unit_lease_occupancy_conflict");
    expect(JSON.stringify(response.body)).not.toContain("providerRequestId");
    expect(JSON.stringify(response.body)).not.toContain("gs://");
    expect(JSON.stringify(response.body)).not.toContain("unit-1");
    expect(JSON.stringify(response.body)).not.toContain("lease-1");
    expect(JSON.stringify(response.body)).not.toContain("tenant-1");
    expect(JSON.stringify(response.body)).not.toContain("payment-1");
  });

  it("does not allow arbitrary landlord lookup from query params", async () => {
    const router = (await import("../landlordPortfolioStatusFinancialRoutes")).default;
    await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-status-financial?landlordId=other-landlord&periodMonth=2026-06",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(loadLandlordPortfolioStatusFinancialInput).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      periodMonth: "2026-06",
    });
  });

  it("returns 200 with degraded metric state when source data is unavailable", async () => {
    loadLandlordPortfolioStatusFinancialInput.mockResolvedValueOnce({
      landlordId: "landlord-1",
      generatedAt: "2026-06-19T12:00:00.000Z",
      periodMonth: "2026-06",
      properties: null,
      units: null,
      leases: null,
      tenants: null,
      rentPayments: null,
      ledgerEntries: null,
      ledgerEvents: null,
      payments: null,
    });
    const router = (await import("../landlordPortfolioStatusFinancialRoutes")).default;

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-status-financial?periodMonth=2026-06",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.generatedAt).toBe("2026-06-19T12:00:00.000Z");
    expect(response.body.confidence).toEqual({ occupancy: "unavailable", financial: "unavailable" });
    expect(response.body.dataQualityFlags).toEqual(
      expect.arrayContaining([
        "ledger_source_unavailable",
        "no_scoped_leases",
        "no_scoped_properties",
        "no_scoped_units",
        "payment_source_unavailable",
      ])
    );
  });

  it("enforces landlord-authenticated scope", async () => {
    const router = (await import("../landlordPortfolioStatusFinancialRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-status-financial",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/portfolio-status-financial",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
    expect(loadLandlordPortfolioStatusFinancialInput).not.toHaveBeenCalled();
  });
});
