import { describe, expect, it } from "vitest";
import {
  DelegatedAccessValidationError,
  createDelegatedAccessGrant,
  createDelegatedAccessInvitation,
  isDelegatedInvitationExpired,
  revokeDelegatedAccessGrant,
  transitionDelegatedInvitationStatus,
} from "../delegatedAccessModel";

const selectedPropertyScope = {
  mode: "selected" as const,
  propertyIds: ["property-1"],
};

describe("delegated access model foundations", () => {
  it("creates pending invitation records with predefined roles and scoped permissions", () => {
    const invitation = createDelegatedAccessInvitation({
      landlordId: "landlord-1",
      inviteeEmail: "Manager@Example.com",
      role: "property_manager",
      propertyScope: selectedPropertyScope,
      workspaceScopes: ["dashboard", "operations", "properties"],
      permissionFlags: ["view", "edit", "message"],
      tokenHash: "token_hash",
      expiresAt: "2026-07-01T00:00:00.000Z",
      createdByUserId: "owner-1",
      createdAt: "2026-06-22T10:00:00.000Z",
    });

    expect(invitation).toMatchObject({
      landlordId: "landlord-1",
      inviteeEmail: "manager@example.com",
      role: "property_manager",
      status: "pending",
      workspaceScopes: ["dashboard", "operations", "properties"],
      permissionFlags: ["view", "edit", "message"],
      acceptedByUserId: null,
      cancelledByUserId: null,
    });
    expect(invitation.invitationId).toMatch(/^delegated_invitation_/);
  });

  it("rejects unsupported roles and owner-only delegated scopes", () => {
    expect(() =>
      createDelegatedAccessInvitation({
        landlordId: "landlord-1",
        inviteeEmail: "delegate@example.com",
        role: "super_admin",
        propertyScope: selectedPropertyScope,
        workspaceScopes: ["dashboard"],
        permissionFlags: ["view"],
        tokenHash: "token_hash",
        expiresAt: "2026-07-01T00:00:00.000Z",
        createdByUserId: "owner-1",
      })
    ).toThrow(new DelegatedAccessValidationError("invalid_delegated_role"));

    expect(() =>
      createDelegatedAccessGrant({
        landlordId: "landlord-1",
        delegateUserId: "delegate-1",
        role: "assistant_office_admin",
        propertyScope: selectedPropertyScope,
        workspaceScopes: ["settings_billing"],
        permissionFlags: ["view"],
        createdByUserId: "owner-1",
      })
    ).toThrow(new DelegatedAccessValidationError("delegated_billing_scope_not_allowed"));
  });

  it("supports invitation acceptance, cancellation, and expiration lifecycle", () => {
    const invitation = createDelegatedAccessInvitation({
      landlordId: "landlord-1",
      inviteeEmail: "delegate@example.com",
      role: "assistant_office_admin",
      propertyScope: selectedPropertyScope,
      workspaceScopes: ["dashboard", "unified_inbox"],
      permissionFlags: ["view", "message"],
      tokenHash: "token_hash",
      expiresAt: "2026-07-01T00:00:00.000Z",
      createdByUserId: "owner-1",
      createdAt: "2026-06-22T10:00:00.000Z",
    });

    expect(isDelegatedInvitationExpired(invitation, "2026-06-30T00:00:00.000Z")).toBe(false);
    expect(isDelegatedInvitationExpired(invitation, "2026-07-01T00:00:00.000Z")).toBe(true);

    const accepted = transitionDelegatedInvitationStatus(invitation, "accepted", {
      acceptedByUserId: "delegate-1",
      timestamp: "2026-06-23T00:00:00.000Z",
    });
    expect(accepted).toMatchObject({
      status: "accepted",
      acceptedByUserId: "delegate-1",
      acceptedAt: "2026-06-23T00:00:00.000Z",
    });

    const cancelled = transitionDelegatedInvitationStatus(invitation, "cancelled", {
      actorUserId: "owner-1",
      timestamp: "2026-06-24T00:00:00.000Z",
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelledByUserId: "owner-1",
      cancelledAt: "2026-06-24T00:00:00.000Z",
    });

    expect(() =>
      transitionDelegatedInvitationStatus(invitation, "accepted", {
        acceptedByUserId: "delegate-1",
        timestamp: "2026-07-02T00:00:00.000Z",
      })
    ).toThrow(new DelegatedAccessValidationError("invitation_expired"));
  });

  it("creates and revokes role assignment records without changing landlord ownership", () => {
    const grant = createDelegatedAccessGrant({
      landlordId: "landlord-1",
      delegateUserId: "delegate-1",
      delegateEmail: "Delegate@Example.com",
      role: "maintenance_coordinator",
      propertyScope: selectedPropertyScope,
      workspaceScopes: ["work_orders", "scheduling"],
      permissionFlags: ["view", "edit", "assign", "message"],
      createdByUserId: "owner-1",
      createdAt: "2026-06-22T10:00:00.000Z",
      acceptedAt: "2026-06-22T11:00:00.000Z",
    });

    expect(grant).toMatchObject({
      landlordId: "landlord-1",
      delegateUserId: "delegate-1",
      delegateEmail: "delegate@example.com",
      role: "maintenance_coordinator",
      status: "active",
      createdByUserId: "owner-1",
      acceptedAt: "2026-06-22T11:00:00.000Z",
    });
    expect(grant.permissionScope.billingAccess).toBe(false);

    const revoked = revokeDelegatedAccessGrant(grant, {
      revokedByUserId: "owner-1",
      revokedAt: "2026-06-25T00:00:00.000Z",
      reason: "Staff changed",
    });
    expect(revoked).toMatchObject({
      status: "revoked",
      revokedByUserId: "owner-1",
      revokedAt: "2026-06-25T00:00:00.000Z",
      revocationReason: "Staff changed",
    });
  });
});
