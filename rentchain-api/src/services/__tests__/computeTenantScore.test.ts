import { describe, expect, it } from "vitest";
import { computeTenantScore } from "../risk/computeTenantScore";

describe("computeTenantScore", () => {
  it("computes a tenant score from lease and payment evidence", () => {
    const result = computeTenantScore({
      activeLeaseCount: 1,
      completedLeaseCount: 2,
      latestLeaseRiskScore: 84,
      averageLeaseRiskScore: 79,
      onTimePaymentRatio: 0.94,
      latePayments: 0,
      missedPayments: 0,
      nsfCount: 0,
      evictionNoticeCount: 0,
      positiveNotesCount: 2,
      evidenceLeaseCount: 3,
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toMatch(/[AB]/);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.factors.leaseRisk).toBeGreaterThanOrEqual(80);
    expect(result.signals).toContain("strong_recent_lease_profile");
  });

  it("degrades confidence instead of collapsing when payment data is missing", () => {
    const result = computeTenantScore({
      activeLeaseCount: 1,
      completedLeaseCount: 0,
      latestLeaseRiskScore: 68,
      averageLeaseRiskScore: 68,
      evidenceLeaseCount: 1,
    });

    expect(result.score).toBeGreaterThan(50);
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.signals).toContain("limited_history_depth");
  });

  it("surfaces elevated payment concerns in signals and recommendations", () => {
    const result = computeTenantScore({
      activeLeaseCount: 1,
      completedLeaseCount: 0,
      latestLeaseRiskScore: 52,
      averageLeaseRiskScore: 55,
      onTimePaymentRatio: 0.62,
      latePayments: 3,
      missedPayments: 1,
      nsfCount: 1,
      evictionNoticeCount: 0,
      positiveNotesCount: 0,
      evidenceLeaseCount: 1,
    });

    expect(result.grade).toMatch(/[CD]/);
    expect(result.signals).toContain("payment_reliability_needs_review");
    expect(result.signals).toContain("repeated_late_payments");
    expect(result.recommendations.join(" ")).toContain("payment");
  });
});
