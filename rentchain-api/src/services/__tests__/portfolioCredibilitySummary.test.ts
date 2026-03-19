import { describe, expect, it } from "vitest";
import { computePortfolioCredibilitySummary } from "../risk/portfolioCredibilitySummary";

describe("portfolioCredibilitySummary", () => {
  it("computes a strong summary when portfolio evidence is healthy", () => {
    const summary = computePortfolioCredibilitySummary({
      leases: [
        { id: "lease-1", propertyId: "prop-1", status: "active", tenantId: "tenant-1", riskScore: 84, riskConfidence: 0.86 },
        { id: "lease-2", propertyId: "prop-2", status: "active", tenantId: "tenant-2", riskScore: 79, riskConfidence: 0.81 },
      ],
      tenants: [
        { id: "tenant-1", tenantScoreValue: 83, tenantScoreConfidence: 0.84 },
        { id: "tenant-2", tenantScoreValue: 78, tenantScoreConfidence: 0.8 },
      ],
    });

    expect(summary).toEqual(
      expect.objectContaining({
        propertyCount: 2,
        activeLeaseCount: 2,
        tenantScoreAverage: 80.5,
        leaseRiskAverage: 81.5,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "strong",
      })
    );
  });

  it("returns limited-data when most portfolio credibility evidence is missing", () => {
    const summary = computePortfolioCredibilitySummary({
      leases: [
        { id: "lease-1", propertyId: "prop-1", status: "active", tenantId: "tenant-1", riskScore: null, riskConfidence: null },
        { id: "lease-2", propertyId: "prop-1", status: "active", tenantId: "tenant-2", riskScore: null, riskConfidence: null },
      ],
      tenants: [{ id: "tenant-1", tenantScoreValue: null, tenantScoreConfidence: null }],
    });

    expect(summary.healthStatus).toBe("limited-data");
    expect(summary.missingCredibilityCount).toBe(4);
    expect(summary.tenantsWithScoreCount).toBe(0);
    expect(summary.leasesWithRiskCount).toBe(0);
  });

  it("returns unknown when there are no active leases", () => {
    const summary = computePortfolioCredibilitySummary({
      leases: [{ id: "lease-1", propertyId: "prop-1", status: "ended", tenantId: "tenant-1", riskScore: 82, riskConfidence: 0.9 }],
      tenants: [{ id: "tenant-1", tenantScoreValue: 81, tenantScoreConfidence: 0.88 }],
    });

    expect(summary.healthStatus).toBe("unknown");
    expect(summary.propertyCount).toBe(0);
    expect(summary.activeLeaseCount).toBe(0);
  });
});
