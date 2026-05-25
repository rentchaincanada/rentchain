import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { routeSource } from "../../middleware/routeSource";

const mocks = vi.hoisted(() => ({
  verifyAuthTokenMock: vi.fn(),
  buildCanonicalSessionUserFromClaimsMock: vi.fn(),
  listAdminPropertiesMock: vi.fn(),
  listAdminTenantsMock: vi.fn(),
  listAdminLeasesMock: vi.fn(),
  loadAdminIntegrityMock: vi.fn(),
  loadAdminAuditMock: vi.fn(),
  listAdminSavedFiltersMock: vi.fn(),
  buildAdminPropertiesCsvMock: vi.fn(),
  recordAdminAuditEventMock: vi.fn(),
}));

vi.mock("../../auth/jwt", () => ({
  verifyAuthToken: mocks.verifyAuthTokenMock,
}));

vi.mock("../../services/sessionUserService", () => ({
  buildCanonicalSessionUserFromClaims: mocks.buildCanonicalSessionUserFromClaimsMock,
}));

vi.mock("../../services/admin/adminPropertyView", () => ({
  listAdminProperties: mocks.listAdminPropertiesMock,
}));

vi.mock("../../services/admin/adminTenantView", () => ({
  listAdminTenants: mocks.listAdminTenantsMock,
}));

vi.mock("../../services/admin/adminLeaseView", () => ({
  listAdminLeases: mocks.listAdminLeasesMock,
}));

vi.mock("../../services/admin/adminIntegrityView", () => ({
  loadAdminIntegrity: mocks.loadAdminIntegrityMock,
}));

vi.mock("../../services/admin/adminAuditView", () => ({
  loadAdminAudit: mocks.loadAdminAuditMock,
}));

vi.mock("../../services/admin/adminSavedFilters", async () => {
  const actual = await vi.importActual<typeof import("../../services/admin/adminSavedFilters")>(
    "../../services/admin/adminSavedFilters"
  );
  return {
    ...actual,
    listAdminSavedFilters: mocks.listAdminSavedFiltersMock,
  };
});

vi.mock("../../services/admin/adminCsvExport", () => ({
  buildAdminPropertiesCsv: mocks.buildAdminPropertiesCsvMock,
}));

vi.mock("../../services/admin/adminAuditEvents", () => ({
  recordAdminAuditEvent: mocks.recordAdminAuditEventMock,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        set: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      }),
    }),
  },
  FieldValue: {
    increment: vi.fn(),
    serverTimestamp: vi.fn(() => Date.now()),
  },
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
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader: vi.fn(),
  } as any;
}

async function runRoute(router: any, method: "get", path: string, req: any) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  if (!layer) throw new Error(`route not found: ${method.toUpperCase()} ${path}`);
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

describe("admin route auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.verifyAuthTokenMock.mockReset();
    mocks.buildCanonicalSessionUserFromClaimsMock.mockReset();
    mocks.listAdminPropertiesMock.mockReset();
    mocks.listAdminTenantsMock.mockReset();
    mocks.listAdminLeasesMock.mockReset();
    mocks.loadAdminIntegrityMock.mockReset();
    mocks.loadAdminAuditMock.mockReset();
    mocks.listAdminSavedFiltersMock.mockReset();
    mocks.buildAdminPropertiesCsvMock.mockReset();
    mocks.recordAdminAuditEventMock.mockReset();

    mocks.listAdminPropertiesMock.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, hasMore: false });
    mocks.listAdminTenantsMock.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, hasMore: false });
    mocks.listAdminLeasesMock.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, hasMore: false });
    mocks.loadAdminIntegrityMock.mockResolvedValue({
      sections: [],
      totals: { issueTypes: 0, totalIssues: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0 },
    });
    mocks.loadAdminAuditMock.mockResolvedValue({
      summary: {
        recentAdminActions: 0,
        recentExports: 0,
        recentIntegrityEvents: 0,
        recentSavedFilterActions: 0,
      },
      sections: { adminActions: [], exports: [], integrityEvents: [], savedFilterActions: [] },
    });
    mocks.listAdminSavedFiltersMock.mockResolvedValue([]);
    mocks.buildAdminPropertiesCsvMock.mockResolvedValue({
      filename: "admin-properties-2026-04-01.csv",
      content: "id,name\n",
      rowCount: 0,
      capped: false,
    });
    mocks.recordAdminAuditEventMock.mockResolvedValue(undefined);
  });

  it("returns 401 for unauthenticated requests on representative admin routes", async () => {
    const [adminPropertiesRoutes, adminAuditRoutes, adminSavedFiltersRoutes] = await Promise.all([
      import("../adminPropertiesRoutes"),
      import("../adminAuditRoutes"),
      import("../adminSavedFiltersRoutes"),
    ]);

    expect((await runRoute(adminPropertiesRoutes.default, "get", "/properties", createReq())).statusCode).toBe(401);
    expect((await runRoute(adminPropertiesRoutes.default, "get", "/properties/export.csv", createReq())).statusCode).toBe(401);
    expect((await runRoute(adminAuditRoutes.default, "get", "/audit", createReq())).statusCode).toBe(401);
    expect(
      (await runRoute(adminSavedFiltersRoutes.default, "get", "/saved-filters", createReq({}, { pageKey: "properties" })))
        .statusCode
    ).toBe(401);
  });

  it("returns 403 for authenticated non-admin requests", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "landlord-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "landlord-1",
      role: "landlord",
      permissions: [],
      revokedPermissions: [],
    });

    const [adminPropertiesRoutes, adminTenantsRoutes, adminLeasesRoutes, adminIntegrityRoutes, adminAuditRoutes] =
      await Promise.all([
        import("../adminPropertiesRoutes"),
        import("../adminTenantsRoutes"),
        import("../adminLeasesRoutes"),
        import("../adminIntegrityRoutes"),
        import("../adminAuditRoutes"),
      ]);

    const authReq = createReq({ authorization: "Bearer landlord-token" });
    expect((await runRoute(adminPropertiesRoutes.default, "get", "/properties", authReq)).statusCode).toBe(403);
    expect((await runRoute(adminTenantsRoutes.default, "get", "/tenants", authReq)).statusCode).toBe(403);
    expect((await runRoute(adminLeasesRoutes.default, "get", "/leases", authReq)).statusCode).toBe(403);
    expect((await runRoute(adminIntegrityRoutes.default, "get", "/integrity", authReq)).statusCode).toBe(403);
    expect((await runRoute(adminAuditRoutes.default, "get", "/audit", authReq)).statusCode).toBe(403);
  });

  it("allows authenticated admins through key admin routes", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "admin-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      permissions: ["system.admin"],
      revokedPermissions: [],
    });

    const [
      adminPropertiesRoutes,
      adminTenantsRoutes,
      adminLeasesRoutes,
      adminIntegrityRoutes,
      adminAuditRoutes,
      adminSavedFiltersRoutes,
    ] = await Promise.all([
      import("../adminPropertiesRoutes"),
      import("../adminTenantsRoutes"),
      import("../adminLeasesRoutes"),
      import("../adminIntegrityRoutes"),
      import("../adminAuditRoutes"),
      import("../adminSavedFiltersRoutes"),
    ]);

    const authReq = createReq({ authorization: "Bearer admin-token" });
    expect((await runRoute(adminPropertiesRoutes.default, "get", "/properties", authReq)).statusCode).toBe(200);
    expect((await runRoute(adminTenantsRoutes.default, "get", "/tenants", authReq)).statusCode).toBe(200);
    expect((await runRoute(adminLeasesRoutes.default, "get", "/leases", authReq)).statusCode).toBe(200);
    expect((await runRoute(adminIntegrityRoutes.default, "get", "/integrity", authReq)).statusCode).toBe(200);
    expect((await runRoute(adminAuditRoutes.default, "get", "/audit", authReq)).statusCode).toBe(200);
    expect(
      (await runRoute(
        adminSavedFiltersRoutes.default,
        "get",
        "/saved-filters",
        createReq({ authorization: "Bearer admin-token" }, { pageKey: "properties" })
      )).statusCode
    ).toBe(200);
    expect((await runRoute(adminPropertiesRoutes.default, "get", "/properties/export.csv", authReq)).statusCode).toBe(200);
  });

  it("returns normalized admin lease and tenant projection fields through the mounted API routes", async () => {
    mocks.verifyAuthTokenMock.mockReturnValue({ sub: "admin-1" });
    mocks.buildCanonicalSessionUserFromClaimsMock.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      permissions: ["system.admin"],
      revokedPermissions: [],
    });
    mocks.listAdminLeasesMock.mockResolvedValueOnce({
      items: [
        {
          id: "ZD2VvH7cCZ7Q8YfVGR55",
          propertyName: "Coburg Rd",
          unitId: "a1O2tQcdEZ7t6y3GHT5G",
          unitNumber: "6",
          tenantName: "Chip Milo",
          leaseDisplayLabel: "Coburg Rd · Unit 6 · Chip Milo",
          startDate: "2026-05-01",
          endDate: "2027-04-30",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      hasMore: false,
    });
    mocks.listAdminTenantsMock.mockResolvedValueOnce({
      items: [
        {
          id: "tenant-chip-milo",
          name: "Chip Milo",
          propertyName: "Coburg Rd",
          unitId: "a1O2tQcdEZ7t6y3GHT5G",
          unitNumber: "6",
          leaseStatus: "active",
          currentLeaseStartDate: "2026-05-01",
          currentLeaseEndDate: "2027-04-30",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      hasMore: false,
    });

    const [adminTenantsRoutes, adminLeasesRoutes] = await Promise.all([
      import("../adminTenantsRoutes"),
      import("../adminLeasesRoutes"),
    ]);

    const app = express();
    app.use("/api/admin", routeSource("adminTenantsRoutes.ts"), adminTenantsRoutes.default);
    app.use("/api/admin", routeSource("adminLeasesRoutes.ts"), adminLeasesRoutes.default);

    const leasesRes = await request(app)
      .get("/api/admin/leases?q=milo&page=1&pageSize=25")
      .set("Authorization", "Bearer admin-token");
    expect(leasesRes.status).toBe(200);
    expect(leasesRes.headers["x-route-source"]).toBe("adminLeasesRoutes.ts");
    expect(leasesRes.body.items[0]).toMatchObject({
      unitNumber: "6",
      leaseDisplayLabel: "Coburg Rd · Unit 6 · Chip Milo",
    });

    const tenantsRes = await request(app)
      .get("/api/admin/tenants?q=milo&page=1&pageSize=25")
      .set("Authorization", "Bearer admin-token");
    expect(tenantsRes.status).toBe(200);
    expect(tenantsRes.headers["x-route-source"]).toBe("adminTenantsRoutes.ts");
    expect(tenantsRes.body.items[0]).toMatchObject({
      unitNumber: "6",
      currentLeaseStartDate: "2026-05-01",
      currentLeaseEndDate: "2027-04-30",
    });

    expect(mocks.listAdminLeasesMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "milo", page: 1, pageSize: 25 })
    );
    expect(mocks.listAdminTenantsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "milo", page: 1, pageSize: 25 })
    );
  });
});
