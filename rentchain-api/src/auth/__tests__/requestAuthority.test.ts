import { describe, expect, it } from "vitest";
import {
  getEffectiveLandlordId,
  getEffectiveTenantId,
  requireAdminAuthority,
  requireLandlordAuthority,
  requireTenantAuthority,
  resolveRequestAuthority,
} from "../requestAuthority";

describe("requestAuthority", () => {
  it("resolves landlord authority with explicit landlordId", () => {
    const authority = resolveRequestAuthority({
      user: { id: "user-1", landlordId: "landlord-1", role: "landlord" },
    });

    expect(authority).toMatchObject({
      actorId: "user-1",
      userId: "user-1",
      actorRole: "landlord",
      landlordId: "landlord-1",
      effectiveLandlordId: "landlord-1",
      effectiveTenantId: null,
      isLandlord: true,
      isAdmin: false,
      authoritySource: "landlord_id",
    });
    expect(getEffectiveLandlordId({ user: { id: "user-1", landlordId: "landlord-1", role: "landlord" } })).toBe(
      "landlord-1"
    );
  });

  it("preserves current landlordId fallback to user id for landlord/admin users", () => {
    expect(getEffectiveLandlordId({ user: { id: "landlord-user", role: "landlord" } })).toBe("landlord-user");
    expect(getEffectiveLandlordId({ user: { id: "admin-user", role: "admin" } })).toBe("admin-user");
  });

  it("prefers actorLandlordId when present and records the override warning", () => {
    const authority = resolveRequestAuthority({
      user: {
        id: "operator-1",
        role: "landlord",
        landlordId: "landlord-1",
        actorRole: "operator",
        actorLandlordId: "landlord-2",
      },
    });

    expect(authority.effectiveLandlordId).toBe("landlord-2");
    expect(authority.actorRole).toBe("operator");
    expect(authority.authoritySource).toBe("actor_landlord_id");
    expect(authority.warnings).toContain("actor_landlord_scope_override");
  });

  it("resolves tenant authority without falling back tenant landlord scope to user id", () => {
    const authority = resolveRequestAuthority({
      user: { id: "tenant-auth-user", role: "tenant", tenantId: "tenant-1", landlordId: "landlord-1" },
    });

    expect(authority).toMatchObject({
      actorRole: "tenant",
      effectiveTenantId: "tenant-1",
      effectiveLandlordId: "landlord-1",
      isTenant: true,
    });
    expect(getEffectiveTenantId({ user: { id: "tenant-auth-user", role: "tenant" } })).toBe("tenant-auth-user");
    expect(getEffectiveLandlordId({ user: { id: "tenant-auth-user", role: "tenant" } })).toBeNull();
  });

  it("marks missing and ambiguous authority explicitly without throwing", () => {
    expect(resolveRequestAuthority({}).errors).toContain("missing_user");

    const authority = resolveRequestAuthority({ user: { id: "user-1", role: "auditor" } });
    expect(authority.actorRole).toBe("unknown");
    expect(authority.warnings).toEqual(expect.arrayContaining(["unknown_actor_role", "unknown_user_role"]));
    expect(requireLandlordAuthority({ user: { id: "tenant-1", role: "tenant" } }).errors).toContain(
      "missing_landlord_authority"
    );
    expect(requireTenantAuthority({ user: { id: "landlord-1", role: "landlord" } }).errors).toContain(
      "missing_tenant_authority"
    );
    expect(requireAdminAuthority({ user: { id: "landlord-1", role: "landlord" } }).errors).toContain(
      "missing_admin_authority"
    );
  });
});
