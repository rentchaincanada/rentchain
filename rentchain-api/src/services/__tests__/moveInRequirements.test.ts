import { describe, expect, it } from "vitest";
import { buildMoveInRequirements } from "../moveInRequirements";

describe("buildMoveInRequirements", () => {
  it("computes complete requirements when all known items are satisfied", () => {
    const requirements = buildMoveInRequirements({
      lease: { status: "signed" },
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
        depositCents: 150000,
        depositReceivedAt: "2026-03-02T10:00:00.000Z",
        insuranceRequired: true,
        insuranceReceivedAt: "2026-03-03T10:00:00.000Z",
        utilitySetupRequired: true,
        utilitySetupReceivedAt: "2026-03-04T10:00:00.000Z",
        inspectionScheduledAt: "2026-03-05T10:00:00.000Z",
        inspectionCompletedAt: "2026-03-06T10:00:00.000Z",
      },
      invite: {
        createdAt: "2026-03-01T08:00:00.000Z",
        redeemedAt: "2026-03-01T12:00:00.000Z",
        status: "redeemed",
      },
    });

    expect(requirements.status).toBe("complete");
    expect(requirements.requiredCount).toBeGreaterThan(0);
    expect(requirements.completedCount).toBe(requirements.requiredCount);
    expect(requirements.progressPercent).toBe(100);
    expect(requirements.items.find((item) => item.key === "keys_release_ready")?.state).toBe("complete");
  });

  it("computes in-progress requirements with pending items", () => {
    const requirements = buildMoveInRequirements({
      lease: { status: "sent" },
      leaseRaw: {
        depositCents: 120000,
        inspectionScheduledAt: "2026-03-05T10:00:00.000Z",
      },
      invite: {
        createdAt: "2026-03-01T08:00:00.000Z",
        status: "sent",
      },
    });

    expect(requirements.status).toBe("in-progress");
    expect(requirements.progressPercent).toBeGreaterThan(0);
    expect(requirements.items.find((item) => item.key === "lease_signed")?.state).toBe("pending");
    expect(requirements.items.find((item) => item.key === "deposit_received")?.state).toBe("pending");
  });

  it("returns unknown when there is no move-in context", () => {
    const requirements = buildMoveInRequirements({ tenant: { id: "tenant-1" } });

    expect(requirements.status).toBe("unknown");
    expect(requirements.requiredCount).toBe(0);
    expect(requirements.progressPercent).toBeNull();
  });

  it("marks optional items as not-required when explicitly disabled", () => {
    const requirements = buildMoveInRequirements({
      lease: { status: "signed" },
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
        depositRequired: false,
        insuranceRequired: false,
        utilitySetupRequired: false,
      },
    });

    expect(requirements.items.find((item) => item.key === "deposit_received")?.state).toBe("not-required");
    expect(requirements.items.find((item) => item.key === "insurance_received")?.state).toBe("not-required");
    expect(requirements.items.find((item) => item.key === "utility_setup_received")?.state).toBe("not-required");
  });
});
