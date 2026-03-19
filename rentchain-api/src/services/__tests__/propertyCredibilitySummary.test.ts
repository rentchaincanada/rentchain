import { describe, expect, it } from "vitest";
import { computePropertyCredibilitySummary } from "../risk/propertyCredibilitySummary";

describe("propertyCredibilitySummary", () => {
  it("computes a strong summary when active leases and tenant scores are healthy", () => {
    const summary = computePropertyCredibilitySummary({
      propertyId: "property-1",
      leases: [
        { id: "lease-1", status: "active", tenantId: "tenant-1", riskScore: 82, riskConfidence: 0.84 },
        { id: "lease-2", status: "active", tenantId: "tenant-2", riskScore: 76, riskConfidence: 0.8 },
      ],
      tenants: [
        { id: "tenant-1", tenantScoreValue: 81, tenantScoreConfidence: 0.83 },
        { id: "tenant-2", tenantScoreValue: 77, tenantScoreConfidence: 0.79 },
      ],
    });

    expect(summary).toEqual(
      expect.objectContaining({
        propertyId: "property-1",
        activeLeaseCount: 2,
        tenantsWithScoreCount: 2,
        leasesWithRiskCount: 2,
        tenantScoreAverage: 79,
        leaseRiskAverage: 79,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "strong",
      })
    );
  });

  it("returns limited-data when most credibility data is missing", () => {
    const summary = computePropertyCredibilitySummary({
      propertyId: "property-2",
      leases: [
        { id: "lease-1", status: "active", tenantId: "tenant-1", riskScore: null, riskConfidence: null },
        { id: "lease-2", status: "active", tenantId: "tenant-2", riskScore: null, riskConfidence: null },
      ],
      tenants: [{ id: "tenant-1", tenantScoreValue: null, tenantScoreConfidence: null }],
    });

    expect(summary.healthStatus).toBe("limited-data");
    expect(summary.missingCredibilityCount).toBe(4);
    expect(summary.tenantsWithScoreCount).toBe(0);
    expect(summary.leasesWithRiskCount).toBe(0);
  });

  it("returns unknown when there are no active leases", () => {
    const summary = computePropertyCredibilitySummary({
      propertyId: "property-3",
      leases: [{ id: "lease-1", status: "ended", tenantId: "tenant-1", riskScore: 84, riskConfidence: 0.9 }],
      tenants: [{ id: "tenant-1", tenantScoreValue: 82, tenantScoreConfidence: 0.88 }],
    });

    expect(summary.healthStatus).toBe("unknown");
    expect(summary.activeLeaseCount).toBe(0);
    expect(summary.tenantScoreAverage).toBeNull();
    expect(summary.leaseRiskAverage).toBeNull();
  });
});
