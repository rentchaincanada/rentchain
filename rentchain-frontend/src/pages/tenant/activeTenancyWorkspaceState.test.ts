import { describe, expect, it } from "vitest";
import { buildActiveTenancyWorkspaceState } from "./activeTenancyWorkspaceState";

describe("activeTenancyWorkspaceState", () => {
  it("stays not active for applicant-stage contexts", () => {
    const view = buildActiveTenancyWorkspaceState({
      context: {
        authority: "applicant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: null,
        tenantId: null,
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      lease: null,
    });

    expect(view.tenancyState).toBe("not_active");
    expect(view.title).toMatch(/has not started/i);
  });

  it("shows transitioning state when tenant access is active but the lease is not yet active", () => {
    const view = buildActiveTenancyWorkspaceState({
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
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: null,
      },
    });

    expect(view.tenancyState).toBe("transitioning_to_active");
    expect(view.label).toMatch(/transitioning/i);
  });

  it("shows active tenancy when active lease context is visible", () => {
    const view = buildActiveTenancyWorkspaceState({
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
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "active",
        documentUrl: "https://example.com/lease.pdf",
        paymentCompletedAt: "2026-04-01T00:00:00.000Z",
      },
    });

    expect(view.tenancyState).toBe("active_tenancy");
    expect(view.summaryItems.join(" ")).toMatch(/tenant workspace access is active/i);
  });

  it("surfaces attention state when an active tenancy has a payment issue", () => {
    const view = buildActiveTenancyWorkspaceState({
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
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "active",
        documentUrl: "https://example.com/lease.pdf",
        paymentStatus: "failed",
      },
    });

    expect(view.tenancyState).toBe("active_but_needs_attention");
    expect(view.needsAttention.join(" ")).toMatch(/payment-related step/i);
  });
});
