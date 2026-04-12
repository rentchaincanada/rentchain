import { describe, expect, it } from "vitest";
import {
  getTenantWorkspaceDefaultDestination,
  resolveTenantWorkspaceAccess,
} from "./tenantWorkspaceAccess";

describe("tenantWorkspaceAccess", () => {
  it("holds tenant routes in a finishing sign-in state while auth or workspace hydration is still running", () => {
    expect(
      resolveTenantWorkspaceAccess({
        hasTenantToken: true,
        authLoading: false,
        workspaceLoading: true,
        workspace: null,
        workspaceError: null,
        requestedPath: "/tenant/dashboard",
      })
    ).toMatchObject({
      status: "loading",
      title: "Finishing sign-in",
    });
  });

  it("redirects back to tenant login when the tenant token is missing", () => {
    expect(
      resolveTenantWorkspaceAccess({
        hasTenantToken: false,
        authLoading: false,
        workspaceLoading: false,
        workspace: null,
        workspaceError: null,
        requestedPath: "/tenant/dashboard",
        requestedSearch: "?tab=lease",
      })
    ).toEqual({
      status: "login_required",
      redirectTo:
        "/tenant/login?reason=expired&next=%2Ftenant%2Fdashboard%3Ftab%3Dlease",
    });
  });

  it("redirects dashboard landings to the invite redemption step when invite authority is active", () => {
    expect(
      resolveTenantWorkspaceAccess({
        hasTenantToken: true,
        authLoading: false,
        workspaceLoading: false,
        workspace: {
          context: {
            authority: "invite",
            propertyId: null,
            rc_prop_id: null,
            applicationId: null,
            leaseId: null,
            tenantId: null,
            unitId: null,
            invitedEmail: "tenant@example.com",
          },
          property: null,
          application: null,
          lease: null,
          maintenance: [],
        },
        workspaceError: null,
        requestedPath: "/tenant/dashboard",
      })
    ).toEqual({
      status: "recovery_required",
      redirectTo: "/tenant/invite/redeem",
      reason: "invite",
    });
  });

  it("redirects dashboard landings to the application route when applicant authority is active", () => {
    expect(
      resolveTenantWorkspaceAccess({
        hasTenantToken: true,
        authLoading: false,
        workspaceLoading: false,
        workspace: {
          context: {
            authority: "applicant",
            propertyId: null,
            rc_prop_id: null,
            applicationId: "app-1",
            leaseId: null,
            tenantId: null,
            unitId: null,
            invitedEmail: "tenant@example.com",
          },
          property: null,
          application: null,
          lease: null,
          maintenance: [],
        },
        workspaceError: null,
        requestedPath: "/tenant/dashboard",
      })
    ).toEqual({
      status: "recovery_required",
      redirectTo: "/tenant/application",
      reason: "application",
    });
  });

  it("preserves a safe intended tenant route once the workspace has loaded", () => {
    expect(
      resolveTenantWorkspaceAccess({
        hasTenantToken: true,
        authLoading: false,
        workspaceLoading: false,
        workspace: {
          context: {
            authority: "applicant",
            propertyId: null,
            rc_prop_id: null,
            applicationId: "app-1",
            leaseId: null,
            tenantId: null,
            unitId: null,
            invitedEmail: "tenant@example.com",
          },
          property: null,
          application: null,
          lease: null,
          maintenance: [],
        },
        workspaceError: null,
        requestedPath: "/tenant/profile",
      })
    ).toEqual({
      status: "ready",
      defaultDestination: "/tenant/application",
    });
  });

  it("derives the active-tenant dashboard as the default ready destination", () => {
    expect(
      getTenantWorkspaceDefaultDestination({
        context: {
          authority: "active_tenant",
          propertyId: "prop-1",
          rc_prop_id: "rc-prop-1",
          applicationId: "app-1",
          leaseId: "lease-1",
          tenantId: "tenant-1",
          unitId: "unit-1",
          invitedEmail: "tenant@example.com",
        },
        property: null,
        application: null,
        lease: null,
        maintenance: [],
      })
    ).toBe("/tenant/dashboard");
  });
});
