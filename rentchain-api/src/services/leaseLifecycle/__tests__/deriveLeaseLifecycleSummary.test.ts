import { describe, expect, it } from "vitest";
import { deriveLeaseLifecycleSummary } from "../deriveLeaseLifecycleSummary";

const NOW = Date.UTC(2026, 3, 28, 12, 0, 0, 0);

describe("deriveLeaseLifecycleSummary", () => {
  it("derives active for a current lease outside the expiry window", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "active",
        leaseStartDate: "2026-01-01",
        leaseEndDate: "2027-12-31",
      },
    });

    expect(summary.lifecycleStatus).toBe("active");
    expect(summary.requiredNextAction).toBe("none");
  });

  it("derives expiring soon when next notice timing is near", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "active",
        leaseEndDate: "2026-06-30",
        nextNoticeDueAt: NOW + 10 * 24 * 60 * 60 * 1000,
      },
    });

    expect(summary.lifecycleStatus).toBe("expiring_soon");
    expect(summary.renewalOutcome).toBe("not_started");
  });

  it("derives renewal pending from a pending latest notice", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "renewal_pending",
        leaseStartDate: "2025-07-01",
        leaseEndDate: "2026-06-30",
      },
      latestNotice: {
        tenantResponse: "pending",
        createdAt: NOW - 1000,
      },
    });

    expect(summary.lifecycleStatus).toBe("renewal_pending");
    expect(summary.history.map((item) => item.label)).toContain("Tenant response pending");
  });

  it("derives no response when deadline has passed", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "renewal_pending",
        leaseEndDate: "2026-06-30",
      },
      latestNotice: {
        tenantResponse: "pending",
        responseDeadlineAt: NOW - 1000,
      },
      noResponse: true,
    });

    expect(summary.lifecycleStatus).toBe("no_response");
    expect(summary.renewalOutcome).toBe("no_response");
  });

  it("derives renewed from a renewal outcome", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "renewal_accepted",
        leaseEndDate: "2026-06-30",
      },
      latestNotice: {
        tenantResponse: "renew",
        updatedAt: NOW - 1000,
      },
    });

    expect(summary.lifecycleStatus).toBe("renewed");
    expect(summary.history.map((item) => item.label)).toContain("Renewed");
  });

  it("derives ending from a quit outcome", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "move_out_pending",
        leaseEndDate: "2026-06-30",
      },
      latestNotice: {
        tenantResponse: "quit",
        updatedAt: NOW - 1000,
      },
    });

    expect(summary.lifecycleStatus).toBe("ending");
    expect(summary.renewalOutcome).toBe("tenant_quitting");
  });

  it("derives expired when lease end date is past", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: "active",
        leaseEndDate: "2026-01-31",
      },
    });

    expect(summary.lifecycleStatus).toBe("expired");
    expect(summary.history.map((item) => item.label)).toContain("Lease expired");
  });

  it("falls back safely when data is ambiguous", () => {
    const summary = deriveLeaseLifecycleSummary({
      now: NOW,
      lease: {
        status: null,
        leaseEndDate: null,
        nextNoticeDueAt: null,
      },
    });

    expect(summary.lifecycleStatus).toBe("blocked");
    expect(summary.history).toEqual([]);
  });
});
