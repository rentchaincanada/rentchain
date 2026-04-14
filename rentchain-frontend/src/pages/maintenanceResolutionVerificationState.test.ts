import { describe, expect, it } from "vitest";
import { buildMaintenanceResolutionVerificationView } from "./maintenanceResolutionVerificationState";

const baseItem = {
  id: "maint-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  propertyId: "prop-1",
  unitId: "unit-1",
  title: "Leaky faucet",
  description: "Kitchen sink is leaking",
  category: "PLUMBING",
  priority: "normal" as const,
  status: "submitted" as const,
  createdAt: 100,
  updatedAt: 200,
};

describe("maintenanceResolutionVerificationState", () => {
  it("marks completed work as awaiting verification when tenant review is pending", () => {
    const view = buildMaintenanceResolutionVerificationView(
      {
        ...baseItem,
        status: "completed",
        serviceCompletedAt: 700,
        completionConfirmedByLandlordAt: 710,
        resolutionStatus: "tenant_pending_signoff",
      },
      "tenant"
    );

    expect(view.verificationState).toBe("awaiting_verification");
    expect(view.tenantVisibleState).toBe("awaiting_your_verification");
  });

  it("marks a tenant-confirmed request as closed when final resolution is recorded", () => {
    const view = buildMaintenanceResolutionVerificationView(
      {
        ...baseItem,
        status: "completed",
        serviceCompletedAt: 700,
        resolutionStatus: "resolved",
        tenantSignoffStatus: "accepted",
        tenantSignedOffAt: 720,
        finalResolvedAt: 720,
      },
      "landlord"
    );

    expect(view.verificationState).toBe("resolved");
    expect(view.closureState).toBe("closed");
    expect(view.timelineEvents.map((event) => event.kind)).toEqual(["resolution_verified", "request_closed"]);
  });

  it("marks declined verification as needs_follow_up", () => {
    const view = buildMaintenanceResolutionVerificationView(
      {
        ...baseItem,
        status: "completed",
        serviceCompletedAt: 700,
        resolutionStatus: "follow_up_required",
        tenantSignoffStatus: "declined",
        tenantDeclinedAt: 730,
        followUpRequired: true,
      },
      "landlord"
    );

    expect(view.verificationState).toBe("needs_follow_up");
    expect(view.closureState).toBe("needs_attention");
    expect(view.blockers.join(" ")).toMatch(/follow-up/i);
  });
});
