import { describe, expect, it } from "vitest";
import { evaluateJurisdictionPolicy } from "../operationalPolicyEvaluator";

describe("evaluateJurisdictionPolicy", () => {
  it("returns Nova Scotia lease renewal review guidance inside the configured window", () => {
    const evaluation = evaluateJurisdictionPolicy({
      province: "NS",
      leaseStatus: "active",
      leaseExecutionStatus: "fully_executed",
      leaseEndDate: "2026-07-15",
      leaseLifecycleStatus: "expiring_soon",
      today: "2026-05-17",
    });

    expect(evaluation.jurisdiction).toBe("NS");
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jurisdiction: "NS",
          policyKey: "lease_renewal_review",
          status: "review",
          legalAdvice: false,
          disclaimer: expect.stringContaining("does not provide legal advice"),
        }),
      ])
    );
  });

  it("returns Ontario lease renewal review guidance inside the configured window", () => {
    const evaluation = evaluateJurisdictionPolicy({
      propertyProvince: "Ontario",
      leaseStatus: "active",
      leaseExecutionStatus: "fully_executed",
      leaseEndDate: "2026-07-01",
      leaseLifecycleStatus: "expiring_soon",
      today: "2026-05-17",
    });

    expect(evaluation.jurisdiction).toBe("ON");
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jurisdiction: "ON",
          policyKey: "lease_renewal_review",
          sourceRuleKey: "ON.lease_renewal_review",
        }),
      ])
    );
  });

  it("returns a missing jurisdiction policy when no province is available", () => {
    const evaluation = evaluateJurisdictionPolicy({
      leaseStatus: "active",
      leaseEndDate: "2026-07-01",
    });

    expect(evaluation.jurisdiction).toBe("UNKNOWN");
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyKey: "missing_jurisdiction",
          severity: "warning",
        }),
        expect.objectContaining({
          policyKey: "missing_province_property_data",
          severity: "warning",
        }),
      ])
    );
  });

  it("returns an unsupported jurisdiction policy for provinces outside the v1 registry", () => {
    const evaluation = evaluateJurisdictionPolicy({
      province: "BC",
      leaseStatus: "active",
      leaseEndDate: "2026-07-01",
    });

    expect(evaluation).toEqual({
      jurisdiction: "UNSUPPORTED",
      results: [
        expect.objectContaining({
          jurisdiction: "UNSUPPORTED",
          policyKey: "unsupported_jurisdiction",
          legalAdvice: false,
        }),
      ],
    });
  });

  it("handles missing or unknown lease dates without crashing", () => {
    const evaluation = evaluateJurisdictionPolicy({
      province: "NS",
      leaseStatus: "active",
      leaseExecutionStatus: "fully_executed",
      leaseEndDate: null,
    });

    expect(evaluation.jurisdiction).toBe("NS");
    expect(evaluation.results.length).toBeGreaterThan(0);
    expect(evaluation.results.some((result) => result.policyKey === "lease_renewal_review")).toBe(false);
  });

  it("surfaces execution readiness review without mutating input", () => {
    const input = {
      province: "ON",
      leaseStatus: "active",
      leaseExecutionStatus: "draft",
      leaseEndDate: "2026-12-31",
      stateCoherence: {
        coherenceStatus: "review_required",
        flags: {
          requiresReview: true,
          leaseMarkedActiveBeforeExecution: true,
        },
      },
    };
    const before = JSON.stringify(input);
    const evaluation = evaluateJurisdictionPolicy(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyKey: "lease_execution_readiness",
          status: "review",
          severity: "warning",
        }),
      ])
    );
  });
});
