import { describe, expect, it } from "vitest";
import { assessLeaseRisk } from "../risk/riskEngine";

describe("assessLeaseRisk", () => {
  it("produces a stable high-confidence grade with complete inputs", () => {
    const result = assessLeaseRisk({
      creditScore: 742,
      monthlyIncome: 7200,
      monthlyRent: 1850,
      employmentMonths: 30,
      onTimePaymentRatio: 0.97,
      latePayments: 0,
      coTenantCount: 1,
      hasGuarantor: false,
    });

    expect(result.version).toBe("risk-v1");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(["A", "B"]).toContain(result.grade);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.flags).not.toContain("Income verification incomplete");
  });

  it("degrades confidence before score when inputs are sparse", () => {
    const result = assessLeaseRisk({
      monthlyRent: 1700,
      coTenantCount: 2,
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.flags).toContain("Income verification incomplete");
    expect(result.recommendations).toContain("Collect income verification to improve confidence in this assessment.");
  });

  it("assigns lower grades to materially weaker signals", () => {
    const result = assessLeaseRisk({
      creditScore: 560,
      monthlyIncome: 3000,
      monthlyRent: 1900,
      employmentMonths: 3,
      onTimePaymentRatio: 0.55,
      latePayments: 4,
      coTenantCount: 4,
      hasGuarantor: false,
    });

    expect(["D", "E"]).toContain(result.grade);
    expect(result.flags).toContain("High rent-to-income ratio");
    expect(result.flags).toContain("Repeated late payment history");
  });
});
