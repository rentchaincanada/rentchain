import { describe, expect, it } from "vitest";
import { buildMoveInReadinessRecord } from "../tenantMoveInReadinessService";

describe("buildMoveInReadinessRecord", () => {
  it("returns ready_for_keys when all gated items are confirmed and keys are not yet released", () => {
    const readiness = buildMoveInReadinessRecord({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      lease: { status: "signed" },
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
        depositCents: 150000,
        depositReceivedAt: "2026-03-02T10:00:00.000Z",
        firstRentReceivedAt: "2026-03-03T10:00:00.000Z",
        insuranceRequired: true,
        insuranceReceivedAt: "2026-03-04T10:00:00.000Z",
        utilitySetupRequired: true,
        utilitySetupReceivedAt: "2026-03-05T10:00:00.000Z",
        inspectionScheduledAt: "2026-03-06T10:00:00.000Z",
        inspectionCompletedAt: "2026-03-07T10:00:00.000Z",
      },
      invite: {
        createdAt: "2026-03-01T08:00:00.000Z",
        redeemedAt: "2026-03-01T12:00:00.000Z",
        status: "redeemed",
      },
    });

    expect(readiness.overallStatus).toBe("ready_for_keys");
    expect(readiness.nextRequiredStep).toBe("Keys released");
    expect(readiness.blockerCount).toBe(0);
  });

  it("returns blocked when a required item is manually blocked", () => {
    const readiness = buildMoveInReadinessRecord({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      lease: { status: "signed" },
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
      },
      persisted: {
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        items: {
          insurance_received: {
            status: "blocked",
            blockerReason: "Waiting on updated policy binder",
            updatedAt: "2026-03-04T10:00:00.000Z",
            updatedByUserId: "landlord-user-1",
          },
        },
      },
    });

    expect(readiness.overallStatus).toBe("blocked");
    expect(readiness.blockerCount).toBe(1);
    expect(readiness.items.find((item) => item.key === "insurance_received")?.status).toBe("blocked");
  });

  it("returns complete when keys are released", () => {
    const readiness = buildMoveInReadinessRecord({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
        keysReleasedAt: "2026-03-08T10:00:00.000Z",
      },
      tenancy: {
        moveInAt: "2026-03-08T12:00:00.000Z",
      },
    });

    expect(readiness.overallStatus).toBe("complete");
    expect(readiness.items.find((item) => item.key === "keys_released")?.status).toBe("confirmed");
  });
});
