import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const units = new Map<string, any>();
const invites = new Map<string, any>();

const dbMock = {
  collection: (name: string) => {
    if (name === "units") {
      return {
        doc: (id: string) => ({
          get: async () => ({
            exists: units.has(id),
            data: () => units.get(id),
          }),
          set: async (value: any, opts?: { merge?: boolean }) => {
            const prev = units.get(id) || {};
            units.set(id, opts?.merge ? { ...prev, ...value } : value);
          },
        }),
      };
    }
    if (name === "tenantInvites") {
      return {
        doc: (id: string) => ({
          set: async (value: any) => {
            invites.set(id, value);
          },
        }),
      };
    }
    throw new Error(`Unexpected collection: ${name}`);
  },
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      email: "owner@example.com",
    };
    next();
  },
}));

vi.mock("../../middleware/requireLandlordOrAdmin", () => ({
  requireLandlordOrAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitTenantInvitesUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true, plan: "starter" })),
}));

describe("POST /api/tenant-invites", () => {
  beforeEach(() => {
    units.clear();
    invites.clear();
    units.set("unit-1", {
      id: "unit-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      occupancyStatus: "vacant",
      status: "vacant",
    });
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM;
    delete process.env.FROM_EMAIL;
  });

  it("creates invite for a unit with no lease and returns inviteUrl", async () => {
    const router = (await import("../tenantInvitesRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/tenant-invites", router);

    const res = await request(app).post("/api/tenant-invites").send({
      tenantEmail: "tenant@example.com",
      tenantName: "Tenant Name",
      propertyId: "property-1",
      unitId: "unit-1",
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(String(res.body?.inviteUrl || "")).toContain("/tenant/invite/");
    expect(res.body?.error).toBeUndefined();
    expect(invites.size).toBe(1);
  }, 30000);
});
