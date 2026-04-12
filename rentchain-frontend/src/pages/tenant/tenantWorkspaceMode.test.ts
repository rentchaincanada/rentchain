import { describe, expect, it } from "vitest";
import { buildTenantWorkspaceModeView, resolveTenantWorkspaceMode } from "./tenantWorkspaceMode";

describe("tenantWorkspaceMode", () => {
  it("classifies invite-linked authority as invite mode", () => {
    expect(
      resolveTenantWorkspaceMode({
        authority: "invite",
        propertyId: null,
        rc_prop_id: null,
        applicationId: null,
        leaseId: null,
        tenantId: null,
        unitId: null,
        invitedEmail: "tenant@example.com",
      })
    ).toBe("invite_mode");
  });

  it("classifies applicant authority as applicant mode", () => {
    const view = buildTenantWorkspaceModeView({
      authority: "applicant",
      propertyId: "prop-1",
      rc_prop_id: "rc-prop-1",
      applicationId: "app-1",
      leaseId: null,
      tenantId: null,
      unitId: "unit-1",
      invitedEmail: "tenant@example.com",
    });

    expect(view.mode).toBe("applicant_mode");
    expect(view.title).toMatch(/application is in progress/i);
    expect(view.nextSteps.map((step) => step.to)).toEqual([
      "/tenant/application",
      "/tenant/attachments",
      "/tenant/access",
    ]);
  });

  it("classifies active tenant contexts as active tenant mode", () => {
    const view = buildTenantWorkspaceModeView({
      authority: "active_tenant",
      propertyId: "prop-1",
      rc_prop_id: "rc-prop-1",
      applicationId: "app-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      invitedEmail: "tenant@example.com",
    });

    expect(view.mode).toBe("active_tenant_mode");
    expect(view.title).toMatch(/workspace is ready/i);
    expect(view.nextSteps.map((step) => step.to)).toEqual([
      "/tenant/dashboard",
      "/tenant/attachments",
      "/tenant/lease",
    ]);
  });
});
