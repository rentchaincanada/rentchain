import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCapability } from "../capabilityGuard";

const getUserEntitlements = vi.fn();
const getEntitlementsForLandlord = vi.fn();

vi.mock("../entitlementsService", () => ({
  getUserEntitlements: (...args: any[]) => getUserEntitlements(...args),
  getEntitlementsForLandlord: (...args: any[]) => getEntitlementsForLandlord(...args),
}));

describe("requireCapability", () => {
  beforeEach(() => {
    getUserEntitlements.mockReset();
    getEntitlementsForLandlord.mockReset();
  });

  it("always allows admin users", async () => {
    const result = await requireCapability("landlord-1", "messaging", {
      id: "admin-1",
      role: "admin",
      plan: "elite",
    });
    expect(result).toEqual({ ok: true, plan: "elite" });
    expect(getUserEntitlements).not.toHaveBeenCalled();
    expect(getEntitlementsForLandlord).not.toHaveBeenCalled();
  });

  it("uses user entitlements when available", async () => {
    getUserEntitlements.mockResolvedValue({
      userId: "u1",
      role: "landlord",
      plan: "pro",
      landlordId: "landlord-1",
      capabilities: ["messaging"],
    });

    const result = await requireCapability("landlord-1", "messaging", {
      id: "u1",
      role: "landlord",
      plan: "pro",
    });
    expect(result).toEqual({ ok: true, plan: "pro" });
  });

  it("returns forbidden with resolved plan for non-admin", async () => {
    getUserEntitlements.mockResolvedValue({
      userId: "u2",
      role: "landlord",
      plan: "starter",
      landlordId: "landlord-2",
      capabilities: [],
    });

    const result = await requireCapability("landlord-2", "messaging", {
      id: "u2",
      role: "landlord",
      plan: "starter",
    });
    expect(result).toEqual({ ok: false, error: "forbidden", plan: "starter" });
  });

  it("falls back to landlord entitlements when user context missing", async () => {
    getEntitlementsForLandlord.mockResolvedValue({
      userId: "landlord-3",
      role: "landlord",
      plan: "pro",
      landlordId: "landlord-3",
      capabilities: ["messaging"],
    });

    const result = await requireCapability("landlord-3", "messaging");
    expect(result).toEqual({ ok: true, plan: "pro" });
    expect(getEntitlementsForLandlord).toHaveBeenCalledWith("landlord-3");
  });
});
