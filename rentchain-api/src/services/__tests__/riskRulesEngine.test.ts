import { describe, expect, it } from "vitest";
import { evaluateRiskAgentContext } from "../riskAgent/riskRulesEngine";
import type { RiskAgentApplicationContext } from "../riskAgent/riskTypes";

function buildContext(overrides: Partial<RiskAgentApplicationContext> = {}): RiskAgentApplicationContext {
  return {
    applicationId: "app-1",
    application: {},
    landlordId: "landlord-1",
    propertyId: "prop-1",
    tenantId: "tenant-1",
    leaseId: null,
    identityStatus: "pending",
    documentStatus: "pending",
    monthlyIncome: 5400,
    monthlyRent: 1800,
    employmentMonths: 14,
    coTenantCount: 1,
    applicationCompleteness: 0.86,
    paymentHistoryRatio: null,
    latePayments: null,
    leaseApplicationConsistency: "unknown",
    reviewSummarySnapshot: {
      screeningStatus: "processing",
      screeningProvider: "TransUnion",
      screeningScoreBand: null,
      applicationStatus: "IN_REVIEW",
    },
    ...overrides,
  };
}

describe("riskRulesEngine", () => {
  it("low income-to-rent ratio lowers the score", () => {
    const strong = evaluateRiskAgentContext(buildContext({ monthlyIncome: 7200, monthlyRent: 1800 }));
    const weak = evaluateRiskAgentContext(buildContext({ monthlyIncome: 3000, monthlyRent: 1800 }));

    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.factors.some((factor) => factor.code === "income_to_rent_low")).toBe(true);
  });

  it("verified identity improves score", () => {
    const pending = evaluateRiskAgentContext(buildContext({ identityStatus: "pending" }));
    const verified = evaluateRiskAgentContext(buildContext({ identityStatus: "verified" }));

    expect(verified.score).toBeGreaterThan(pending.score);
    expect(verified.factors.some((factor) => factor.code === "identity_verified")).toBe(true);
  });

  it("missing critical documents produces flags and recommendations", () => {
    const result = evaluateRiskAgentContext(buildContext({ documentStatus: "missing" }));

    expect(result.flags).toContain("Missing required documents");
    expect(result.recommendations.some((item) => item.toLowerCase().includes("missing application documents"))).toBe(true);
  });

  it("incomplete application lowers confidence", () => {
    const complete = evaluateRiskAgentContext(buildContext({ applicationCompleteness: 0.94 }));
    const incomplete = evaluateRiskAgentContext(buildContext({ applicationCompleteness: 0.32 }));

    expect(incomplete.confidence).toBeLessThan(complete.confidence);
  });

  it("stable employment improves score", () => {
    const stable = evaluateRiskAgentContext(buildContext({ employmentMonths: 36 }));
    const short = evaluateRiskAgentContext(buildContext({ employmentMonths: 3 }));

    expect(stable.score).toBeGreaterThan(short.score);
  });

  it("missing data produces insufficient_data safely", () => {
    const result = evaluateRiskAgentContext(
      buildContext({
        monthlyIncome: null,
        monthlyRent: null,
        employmentMonths: null,
        applicationCompleteness: null,
        identityStatus: "unknown",
        documentStatus: "unknown",
      })
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("recommendations correspond to triggered rules", () => {
    const result = evaluateRiskAgentContext(
      buildContext({
        monthlyIncome: 3100,
        monthlyRent: 1900,
        identityStatus: "needs_review",
      })
    );

    expect(result.recommendations.some((item) => item.toLowerCase().includes("identity verification"))).toBe(true);
    expect(result.status).toBe("manual_review_required");
  });

  it("maps score bands to grades deterministically", () => {
    expect(evaluateRiskAgentContext(buildContext({ monthlyIncome: 9000, monthlyRent: 1800, identityStatus: "verified", documentStatus: "verified", employmentMonths: 48, applicationCompleteness: 0.98 })).grade).toBe("A");
    expect(evaluateRiskAgentContext(buildContext({ monthlyIncome: 2500, monthlyRent: 1800, identityStatus: "missing", documentStatus: "missing", employmentMonths: 2, applicationCompleteness: 0.4 })).grade).toBe("E");
  });
});
