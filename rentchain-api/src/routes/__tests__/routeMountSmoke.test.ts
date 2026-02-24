import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { routeSource } from "../../middleware/routeSource";
import { leaseService } from "../../services/leaseService";

const listTenanciesByTenantId = vi.fn();

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

vi.mock("../../services/tenantDetailsService", () => ({
  getTenantDetailBundle: vi.fn(),
  getTenantsList: vi.fn(),
}));

vi.mock("../../services/tenantLedgerService", () => ({
  getTenantLedger: vi.fn(),
}));

vi.mock("../../services/tenantReportService", () => ({
  generateTenantReportPdfBuffer: vi.fn(),
}));

vi.mock("../../services/tenanciesService", () => ({
  listTenanciesByTenantId,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => null }),
        set: async () => undefined,
      }),
    }),
  },
}));

vi.mock("../../services/leaseDraftsService", () => ({
  NS_PROVINCE: "NS",
  NS_TEMPLATE_VERSION: "ns-schedule-a-v1",
  applyPatch: vi.fn((existing: any) => existing),
  validateCreateInput: vi.fn(() => ({})),
  getDraftById: vi.fn(async () => ({ exists: false, data: () => null, id: "draft" })),
  getSnapshotById: vi.fn(async () => ({ exists: false, data: () => null, id: "snap" })),
  generateScheduleA: vi.fn(async () => ({
    kind: "schedule-a-pdf",
    url: "https://example.invalid/schedule-a.pdf",
    sha256: "abc123",
    sizeBytes: 123,
    bucket: "bucket",
    objectKey: "leases/x/y.pdf",
  })),
}));

describe("route mount smoke", () => {
  it("unauthenticated requests return 401 on protected endpoints", async () => {
    const leaseRoutes = (await import("../leaseRoutes")).default;
    const tenantsRoutes = (await import("../tenantsRoutes")).default;
    const complianceRoutes = (await import("../complianceRoutes")).default;

    const app = express();
    app.use(express.json());
    app.use("/api/leases", routeSource("leaseRoutes.ts"), leaseRoutes);
    app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes);
    app.use("/api/compliance", routeSource("complianceRoutes.ts"), complianceRoutes);

    const leasesRes = await request(app).get("/api/leases/tenant/tenant-1");
    expect(leasesRes.status).toBe(401);

    const tenanciesRes = await request(app).get("/api/tenants/tenant-1/tenancies");
    expect(tenanciesRes.status).toBe(401);

    const rulesRes = await request(app).get("/api/compliance/rules?province=ON");
    expect(rulesRes.status).toBe(401);
  });

  it("authed requests return 200 for lease, tenancies, and compliance routes", async () => {
    listTenanciesByTenantId.mockResolvedValueOnce([]);
    leaseService.getAll().splice(0);
    leaseService.create({
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitNumber: "A",
      monthlyRent: 1000,
      startDate: "2026-01-01",
    });

    const leaseRoutes = (await import("../leaseRoutes")).default;
    const tenantsRoutes = (await import("../tenantsRoutes")).default;
    const complianceRoutes = (await import("../complianceRoutes")).default;

    const app = express();
    app.use(express.json());
    app.use("/api/leases", routeSource("leaseRoutes.ts"), leaseRoutes);
    app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes);
    app.use("/api/compliance", routeSource("complianceRoutes.ts"), complianceRoutes);

    const auth = { Authorization: "Bearer test-token" };

    const leasesRes = await request(app).get("/api/leases/tenant/tenant-1").set(auth);
    expect(leasesRes.status).toBe(200);
    expect(leasesRes.body?.ok).toBe(true);
    expect(Array.isArray(leasesRes.body?.leases)).toBe(true);
    expect(leasesRes.headers["x-route-source"]).toBe("leaseRoutes.ts");

    const tenanciesRes = await request(app).get("/api/tenants/tenant-1/tenancies").set(auth);
    expect(tenanciesRes.status).toBe(200);
    expect(tenanciesRes.body).toEqual({ ok: true, tenancies: [] });
    expect(tenanciesRes.headers["x-route-source"]).toBe("tenantsRoutes.ts");

    const rulesRes = await request(app).get("/api/compliance/rules?province=ON").set(auth);
    expect(rulesRes.status).toBe(200);
    expect(rulesRes.body?.ok).toBe(true);
    expect(rulesRes.body?.province).toBe("ON");
    expect(rulesRes.headers["x-route-source"]).toBe("complianceRoutes.ts");
  });
});
