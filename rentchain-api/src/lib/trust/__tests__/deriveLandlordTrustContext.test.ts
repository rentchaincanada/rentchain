import { describe, expect, it } from "vitest";
import { deriveLandlordTrustContext } from "../deriveLandlordTrustContext";

describe("deriveLandlordTrustContext", () => {
  it("derives strong trust context from complete safe signals", () => {
    const result = deriveLandlordTrustContext({
      tenantIdentitySummary: {
        identityStatus: "verified",
        verification: { level: "strong" },
        readinessLabel: "Well established",
        readinessDescription: "Supporting records are strong.",
      },
      completenessScore: 0.92,
      completenessFlags: [],
      screeningStatus: "completed",
      applicationReusable: true,
    });

    expect(result.trustReadiness).toBe("strong");
    expect(result.recommendedNextAction).toBe("prepare_lease");
    expect(result.positiveSignals).toContain("Application information is mostly complete.");
    expect(result.positiveSignals).toContain("Screening status is available as a normalized signal.");
  });

  it("fails closed to limited when major signals are missing", () => {
    const result = deriveLandlordTrustContext({
      tenantIdentitySummary: {
        identityStatus: "limited",
        verification: { level: "none" },
        readinessLabel: "Getting started",
        readinessDescription: "Signals are still limited.",
      },
      completenessScore: 0.3,
      completenessFlags: ["MISSING_EMPLOYER_NAME", "MISSING_SIGNATURE"],
      screeningStatus: "not_run",
      applicationReusable: false,
    });

    expect(result.trustReadiness).toBe("limited");
    expect(result.recommendedNextAction).toBe("request_missing_info");
    expect(result.missingSignals).toContain("Employment or income details are still incomplete.");
    expect(result.cautionSignals.some((item) => item.toLowerCase().includes("consent or identity"))).toBe(true);
  });
});
