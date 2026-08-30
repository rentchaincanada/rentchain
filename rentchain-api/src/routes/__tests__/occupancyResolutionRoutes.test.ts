import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getContext, resolve, getTenantContext, resolveTenant } = vi.hoisted(() => ({ getContext: vi.fn(), resolve: vi.fn(), getTenantContext: vi.fn(), resolveTenant: vi.fn() }));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));
vi.mock("../../services/capabilityGuard", () => ({ requireCapability: vi.fn(async () => ({ ok: true })) }));
vi.mock("../../services/occupancyResolutionService", async () => {
  const actual: any = await vi.importActual("../../services/occupancyResolutionService");
  return { ...actual, getOccupancyResolutionContext: getContext, resolveOccupancy: resolve, getTenantRelationshipResolutionContext: getTenantContext, resolveStaleTenantRelationshipStatus: resolveTenant };
});

const context = {
  propertyId: "property-1", unitId: "unit-1", tenantId: null, expectedStateToken: "state-1",
  canonicalState: { occupancyState: "review_needed", supportingLeaseId: null, reasons: ["MULTIPLE_CURRENT_LEASES"] },
  eligibleResolutionTypes: ["resolve_multiple_current_leases"], existingLeaseCandidates: [{ id: "lease-a" }, { id: "lease-b" }],
};

async function app() {
  const router = (await import("../occupancyResolutionRoutes")).default;
  const instance = express();
  instance.use(express.json());
  instance.use(router);
  return instance;
}

describe("occupancyResolutionRoutes", () => {
  beforeEach(() => {
    getContext.mockReset().mockResolvedValue(context);
    resolve.mockReset().mockResolvedValue({ context: { ...context, canonicalState: { occupancyState: "occupied", supportingLeaseId: "lease-a", reasons: [] } }, auditEventId: "event-1", idempotent: false });
    getTenantContext.mockReset().mockResolvedValue({ tenantId: "tenant-1", eligible: true, expectedStateToken: "tenant-state-1" });
    resolveTenant.mockReset().mockResolvedValue({ context: { postRepairLifecycle: "Past" }, auditEventId: "tenant-event", idempotent: false, outcome: "resolved" });
  });

  it("returns the complete server-authoritative multiple-current context", async () => {
    const response = await request(await app()).get("/context?propertyId=property-1&unitId=unit-1");
    expect(response.status).toBe(200);
    expect(response.body.context.existingLeaseCandidates).toHaveLength(2);
    expect(getContext).toHaveBeenCalledWith({ landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: null });
  });

  it("requires a caller-owned Idempotency-Key header", async () => {
    const response = await request(await app()).post("/").send({ propertyId: "property-1", unitId: "unit-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: "state-1", confirmation: true });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: "idempotency_key_required" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("submits an explicit selected candidate and forwards the header idempotency key", async () => {
    const response = await request(await app()).post("/").set("Idempotency-Key", "multiple-current-resolution-1").send({ propertyId: "property-1", unitId: "unit-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: "state-1", confirmation: true });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ landlordId: "landlord-1", selectedLeaseId: "lease-a", expectedStateToken: "state-1", idempotencyKey: "multiple-current-resolution-1" }));
  });

  it("returns and submits the tenant-scoped status-only resolution without unit context", async () => {
    const instance = await app();
    const get = await request(instance).get("/context?tenantId=tenant-1");
    expect(get.status).toBe(200);
    expect(getTenantContext).toHaveBeenCalledWith({ landlordId: "landlord-1", tenantId: "tenant-1" });
    const post = await request(instance).post("/").set("Idempotency-Key", "tenant-status-1").send({ tenantId: "tenant-1", type: "reconcile_stale_tenant_relationship_status", expectedStateToken: "tenant-state-1", confirmation: true });
    expect(post.status).toBe(200);
    expect(resolveTenant).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", expectedStateToken: "tenant-state-1", idempotencyKey: "tenant-status-1" }));
  });

  it.each([
    ["selected_lease_not_eligible", 409],
    ["occupancy_state_stale", 409],
    ["multiple_current_no_longer_present", 409],
    ["forbidden", 403],
  ])("returns a bounded %s response", async (code, status) => {
    const { OccupancyResolutionError } = await import("../../services/occupancyResolutionService");
    resolve.mockRejectedValueOnce(new OccupancyResolutionError(code, status, status === 409 ? context as any : undefined));
    const response = await request(await app()).post("/").set("Idempotency-Key", "multiple-current-resolution-2").send({ propertyId: "property-1", unitId: "unit-1", type: "resolve_multiple_current_leases", selectedLeaseId: "lease-a", expectedStateToken: "state-1", confirmation: true });
    expect(response.status).toBe(status);
    expect(response.body.error).toBe(code);
    expect(response.body).not.toHaveProperty("stack");
  });
});
