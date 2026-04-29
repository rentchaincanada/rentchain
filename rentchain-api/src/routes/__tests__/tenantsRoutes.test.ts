import { beforeEach, describe, expect, it, vi } from "vitest";

const setMock = vi.fn(async () => undefined);
const getTenantDetailBundleMock = vi.fn();
const getTenantsListMock = vi.fn();
const leaseDocs = new Map<string, any>();
const propertyDocs = new Map<string, any>();

vi.mock("../../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id?: string) => ({
        set: setMock,
        get: async () => {
          if (name === "properties" && id) {
            return {
              id,
              exists: propertyDocs.has(id),
              data: () => propertyDocs.get(id),
            };
          }
          return { id, exists: false, data: () => undefined };
        },
      }),
      where: (field: string, op: string, value: any) => ({
        get: async () => {
          if (name !== "leases") return { docs: [] };
          const docs = Array.from(leaseDocs.entries())
            .filter(([, data]) => {
              if (field === "tenantId" && op === "==" ) return data?.tenantId === value;
              if (field === "tenantIds" && op === "array-contains") {
                return Array.isArray(data?.tenantIds) && data.tenantIds.includes(value);
              }
              return false;
            })
            .map(([id, data]) => ({ id, data: () => data }));
          return { docs };
        },
      }),
    }),
  },
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../services/tenantDetailsService", () => ({
  getTenantDetailBundle: getTenantDetailBundleMock,
  getTenantsList: getTenantsListMock,
}));

vi.mock("../../services/tenantLedgerService", () => ({
  getTenantLedger: vi.fn(async () => []),
}));

vi.mock("../../services/tenantReportService", () => ({
  generateTenantReportPdfBuffer: vi.fn(async () => Buffer.from("pdf")),
}));

vi.mock("../../services/tenanciesService", () => ({
  listTenanciesByTenantId: vi.fn(async () => []),
}));

vi.mock("../../services/tenantMoveInReadinessService", () => ({
  updateMoveInReadinessItems: vi.fn(async () => undefined),
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: {},
      query: {},
      params: { tenantId: "tenant-1" },
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
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("tenantsRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    setMock.mockClear();
    getTenantDetailBundleMock.mockReset();
    getTenantsListMock.mockReset();
    leaseDocs.clear();
    propertyDocs.clear();
  });

  it("filters hidden tenants from the landlord list route", async () => {
    getTenantsListMock.mockResolvedValue([]);
    const router = (await import("../tenantsRoutes")).default;

    const result = await invokeRouter(router, {
      method: "GET",
      url: "/",
    });

    expect(result.status).toBe(200);
    expect(getTenantsListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        landlordId: "landlord-1",
        excludeHiddenFromActiveLists: true,
      })
    );
  });

  it("updates only basic tenant profile fields", async () => {
    getTenantDetailBundleMock
      .mockResolvedValueOnce({ tenant: { id: "tenant-1", fullName: "Before" } })
      .mockResolvedValueOnce({
        tenant: {
          id: "tenant-1",
          fullName: "Taylor Tenant",
          email: "tenant@example.com",
          phone: "9025550100",
        },
      });

    const router = (await import("../tenantsRoutes")).default;
    const result = await invokeRouter(router, {
      method: "PATCH",
      url: "/tenant-1",
      body: {
        fullName: "Taylor Tenant",
        email: "Tenant@Example.com",
        phone: "9025550100",
      },
    });

    expect(result.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "9025550100",
      }),
      { merge: true }
    );
    expect(result.body?.tenant?.fullName).toBe("Taylor Tenant");
  });

  it("returns landlord-safe lease labels for tenant lease history", async () => {
    leaseDocs.set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-raw-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: null,
      status: "active",
    });
    propertyDocs.set("prop-raw-1", {
      name: "Harbour View",
      addressLine1: "123 Harbour St",
    });

    const router = (await import("../leaseRoutes")).default;
    const result = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/tenant-1",
      body: {},
    });

    expect(result.status).toBe(200);
    expect(result.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        propertyAddress: "123 Harbour St",
        propertyName: "Harbour View",
        propertyLabel: "Harbour View",
      })
    );
  });
});
