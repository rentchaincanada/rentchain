import { describe, expect, it } from "vitest";
import { buildTenantSafeWorkOrderNotifications, computeWorkOrderNotifications } from "../maintenanceNotifications";

describe("maintenanceNotifications", () => {
  it("derives review, contractor, and tenant flags from rework workflow state", () => {
    const notifications = computeWorkOrderNotifications({
      reworkCycle: {
        status: "assigned",
        schedule: {
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "pending",
        },
      },
      reworkReview: {
        status: "pending_review",
      },
    });

    expect(notifications.landlord.requiresReview).toBe(true);
    expect(notifications.landlord.requiresReschedule).toBe(false);
    expect(notifications.contractor.requiresScheduleConfirmation).toBe(true);
    expect(notifications.contractor.requiresExecutionStart).toBe(false);
    expect(notifications.tenant.requiresAccessConfirmation).toBe(true);
    expect(notifications.tenant.requiresSignoff).toBe(false);
  });

  it("builds a tenant-safe subset without internal landlord or contractor flags", () => {
    const tenantSafe = buildTenantSafeWorkOrderNotifications({
      reworkCycle: {
        status: "in_progress",
        schedule: {
          status: "confirmed",
          requiresTenantAccess: false,
          tenantAccessStatus: "not_required",
          contractorScheduleStatus: "confirmed",
        },
      },
      reworkReview: {
        status: "tenant_pending_signoff",
      },
      notifications: {
        landlord: {
          requiresReview: true,
          requiresReschedule: true,
          lastNotifiedAt: 100,
        },
      },
    });

    expect(tenantSafe).toEqual({
      tenant: {
        requiresAccessConfirmation: false,
        requiresSignoff: true,
        requiresReworkAwareness: true,
      },
    });
  });
});
