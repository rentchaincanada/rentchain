import { describe, expect, it } from "vitest";
import { deriveTenantLifecycle } from "../deriveTenantLifecycle";

describe("deriveTenantLifecycle", () => {
  it("prioritizes archived over active signals and marks a conflict", () => {
    const result = deriveTenantLifecycle({
      tenantStatus: "active",
      leaseStatus: "active",
      isArchived: true,
    });

    expect(result.lifecycleState).toBe("archived");
    expect(result.lifecycleLabel).toBe("Archived");
    expect(result.flags.hasActiveLease).toBe(true);
    expect(result.flags.isArchived).toBe(true);
    expect(result.flags.hasStateConflict).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("derives active from a current lease before legacy tenant status", () => {
    const result = deriveTenantLifecycle({
      tenantStatus: "Current",
      leaseStatus: "active",
      occupancyStatus: "occupied",
    });

    expect(result.lifecycleState).toBe("active");
    expect(result.lifecycleReason).toBe("active_tenancy_or_lease_signal");
    expect(result.confidence).toBe("high");
    expect(result.sourceFields).toMatchObject({
      tenantStatus: "Current",
      leaseStatus: "active",
      occupancyStatus: "occupied",
    });
  });

  it("maps screening and application status without requiring a tenant record", () => {
    expect(
      deriveTenantLifecycle({ applicationStatus: "submitted", screeningStatus: "processing" }).lifecycleState
    ).toBe("screening_in_progress");
    expect(
      deriveTenantLifecycle({ applicationStatus: "approved", screeningStatus: "complete" }).lifecycleState
    ).toBe("approved");
    expect(deriveTenantLifecycle({ applicationStatus: "rejected" }).lifecycleState).toBe("rejected");
    expect(deriveTenantLifecycle({ applicationStatus: "withdrawn" }).lifecycleState).toBe("withdrawn");
  });

  it("maps lease and occupancy lifecycle states deterministically", () => {
    expect(deriveTenantLifecycle({ leaseStatus: "pending_signature" }).lifecycleState).toBe("lease_sent");
    expect(deriveTenantLifecycle({ leaseStatus: "signed" }).lifecycleState).toBe("lease_signed");
    expect(deriveTenantLifecycle({ leaseStatus: "notice_pending" }).lifecycleState).toBe("notice_pending");
    expect(deriveTenantLifecycle({ occupancyStatus: "inactive" }).lifecycleState).toBe("past");
  });

  it("returns unknown with low confidence when no lifecycle fields are present", () => {
    const result = deriveTenantLifecycle({});

    expect(result.lifecycleState).toBe("unknown");
    expect(result.confidence).toBe("low");
    expect(result.lifecycleReason).toBe("insufficient_lifecycle_data");
  });
});
