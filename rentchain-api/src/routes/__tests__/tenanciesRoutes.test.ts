import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthMode = "allow" | "deny";

async function makeApp(authMode: AuthMode, tenancyLandlordId = "landlord-1") {
  vi.resetModules();
  vi.doMock("../../middleware/requireLandlord", () => ({
    requireLandlord: (req: any, res: any, next: any) => {
      if (authMode === "deny") {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      req.user = { id: "user-1", role: "landlord", landlordId: "landlord-1" };
      return next();
    },
  }));

  vi.doMock("../../services/tenanciesService", () => ({
    listTenanciesByTenantId: vi.fn(async () => []),
    getTenancyById: vi.fn(async (id: string) => {
      if (id === "missing") return null;
      return {
        id,
        tenantId: "tenant-1",
        landlordId: tenancyLandlordId,
        status: "active",
      };
    }),
    updateTenancyLifecycle: vi.fn(async (id: string, patch: any) => ({
      id,
      tenantId: "tenant-1",
      landlordId: tenancyLandlordId,
      status: patch?.status ?? "active",
      moveOutAt: patch?.moveOutAt ?? null,
      moveOutReason: patch?.moveOutReason ?? null,
      moveOutReasonNote: patch?.moveOutReasonNote ?? null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    })),
  }));

  const router = (await import("../tenanciesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("tenanciesRoutes PATCH /tenancies/:tenancyId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 200 and updates tenancy fields", async () => {
    const app = await makeApp("allow");
    const res = await request(app).patch("/api/tenancies/tenancy-1").send({
      status: "inactive",
      moveOutAt: "2026-03-01",
      moveOutReason: "LEASE_TERM_END",
      moveOutReasonNote: "tenant gave notice",
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.tenancy?.id).toBe("tenancy-1");
    expect(res.body?.tenancy?.status).toBe("inactive");
  });

  it("returns 401 when unauthenticated", async () => {
    const app = await makeApp("deny");
    const res = await request(app).patch("/api/tenancies/tenancy-1").send({ status: "inactive" });

    expect(res.status).toBe(401);
    expect(res.body?.ok).toBe(false);
  });

  it("returns 403 for wrong landlord", async () => {
    const app = await makeApp("allow", "other-landlord");
    const res = await request(app).patch("/api/tenancies/tenancy-1").send({ status: "inactive" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns 404 when tenancy is missing", async () => {
    const app = await makeApp("allow");
    const res = await request(app).patch("/api/tenancies/missing").send({ status: "inactive" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "tenancy_not_found" });
  });
});

