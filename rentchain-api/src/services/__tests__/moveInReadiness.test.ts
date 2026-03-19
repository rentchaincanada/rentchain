import { describe, expect, it } from "vitest";
import { buildMoveInReadiness } from "../moveInReadiness";

describe("buildMoveInReadiness", () => {
  it("returns ready when all known pre-move-in requirements are complete", () => {
    const readiness = buildMoveInReadiness({
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
        updatedAt: "2026-03-06T10:00:00.000Z",
      },
      invite: {
        createdAt: "2026-03-01T09:00:00.000Z",
        redeemedAt: "2026-03-01T12:00:00.000Z",
        status: "redeemed",
      },
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.keysReleaseReady).toBe(true);
    expect(readiness.readinessPercent).toBe(100);
    expect(readiness.outstandingItems).toEqual([]);
    expect(readiness.completedItems).toContain("Deposit received");
  });

  it("returns in-progress when some requirements are complete and some remain", () => {
    const readiness = buildMoveInReadiness({
      lease: { status: "sent" },
      leaseRaw: {
        depositCents: 120000,
        insuranceRequired: true,
        inspectionScheduledAt: "2026-03-05T10:00:00.000Z",
      },
      invite: {
        createdAt: "2026-03-01T09:00:00.000Z",
        status: "sent",
      },
    });

    expect(readiness.status).toBe("in-progress");
    expect(readiness.readinessPercent).toBeGreaterThan(0);
    expect(readiness.outstandingItems).toContain("Lease signature pending");
    expect(readiness.outstandingItems).toContain("Collect deposit");
    expect(readiness.outstandingItems).toContain("Collect tenant insurance proof");
  });

  it("returns not-started when known requirements exist but none are complete", () => {
    const readiness = buildMoveInReadiness({
      lease: { status: "draft" },
      leaseRaw: {
        depositCents: 120000,
        insuranceRequired: true,
      },
    });

    expect(readiness.status).toBe("not-started");
    expect(readiness.readinessPercent).toBe(0);
  });

  it("returns not-started when lease context exists but no required steps are complete", () => {
    const readiness = buildMoveInReadiness({ lease: { status: "draft" } });

    expect(readiness.status).toBe("not-started");
    expect(readiness.readinessPercent).toBe(0);
    expect(readiness.completedItems).toEqual([]);
  });

  it("returns unknown when there is no usable move-in evidence", () => {
    const readiness = buildMoveInReadiness({ tenant: { id: "tenant-1" } });

    expect(readiness.status).toBe("unknown");
    expect(readiness.readinessPercent).toBeNull();
    expect(readiness.completedItems).toEqual([]);
  });

  it("returns completed when keys are released or move-in is recorded", () => {
    const readiness = buildMoveInReadiness({
      leaseRaw: {
        tenantSignedAt: "2026-03-01T10:00:00.000Z",
        keysReleasedAt: "2026-03-08T10:00:00.000Z",
      },
      tenancy: {
        moveInAt: "2026-03-08T12:00:00.000Z",
      },
    });

    expect(readiness.status).toBe("completed");
    expect(readiness.completedItems).toContain("Keys released");
    expect(readiness.completedItems).toContain("Move-in recorded");
  });
});
