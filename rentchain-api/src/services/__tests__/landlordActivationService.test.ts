import { describe, expect, it } from "vitest";
import {
  deriveLandlordActivationSummary,
} from "../activation/landlordActivationService";
import type { LandlordActivationSnapshot } from "../activation/landlordActivationTypes";

function buildSnapshot(
  overrides: Partial<LandlordActivationSnapshot> = {}
): LandlordActivationSnapshot {
  return {
    propertyCount: 0,
    unitCount: 0,
    applicationCount: 0,
    viewingCount: 0,
    transunionStatus: "not_connected",
    hasScreening: false,
    hasDecisionReview: false,
    primaryApplicationId: null,
    reviewApplicationId: null,
    ...overrides,
  };
}

describe("deriveLandlordActivationSummary", () => {
  it("returns all steps in the expected order for a fresh landlord", () => {
    const result = deriveLandlordActivationSummary(buildSnapshot());

    expect(result.steps.map((step) => step.key)).toEqual([
      "property",
      "unit",
      "applicant",
      "viewing",
      "transunion",
      "screening",
      "decision",
    ]);
    expect(result.steps[0]?.status).toBe("in_progress");
    expect(result.steps[1]?.status).toBe("blocked");
    expect(result.nextStepKey).toBe("property");
  });

  it("marks property and unit complete when setup data exists", () => {
    const result = deriveLandlordActivationSummary(
      buildSnapshot({ propertyCount: 1, unitCount: 1 })
    );

    expect(result.steps[0]?.status).toBe("completed");
    expect(result.steps[1]?.status).toBe("completed");
    expect(result.nextStepKey).toBe("applicant");
  });

  it("marks viewing complete when a viewing request exists", () => {
    const result = deriveLandlordActivationSummary(
      buildSnapshot({
        propertyCount: 1,
        unitCount: 1,
        applicationCount: 1,
        viewingCount: 1,
        primaryApplicationId: "app-1",
      })
    );

    expect(result.steps.find((step) => step.key === "viewing")?.status).toBe("completed");
    expect(result.nextStepKey).toBe("transunion");
  });

  it("marks transunion complete when the integration is connected", () => {
    const result = deriveLandlordActivationSummary(
      buildSnapshot({
        propertyCount: 1,
        unitCount: 1,
        applicationCount: 1,
        viewingCount: 1,
        primaryApplicationId: "app-1",
        transunionStatus: "connected",
      })
    );

    expect(result.steps.find((step) => step.key === "transunion")?.status).toBe("completed");
    expect(result.nextStepKey).toBe("screening");
  });

  it("marks screening and decision complete when review data exists", () => {
    const result = deriveLandlordActivationSummary(
      buildSnapshot({
        propertyCount: 1,
        unitCount: 1,
        applicationCount: 1,
        viewingCount: 1,
        primaryApplicationId: "app-1",
        reviewApplicationId: "app-1",
        transunionStatus: "connected",
        hasScreening: true,
        hasDecisionReview: true,
      })
    );

    expect(result.steps.find((step) => step.key === "screening")?.status).toBe("completed");
    expect(result.steps.find((step) => step.key === "decision")?.status).toBe("completed");
    expect(result.nextStepKey).toBeNull();
    expect(result.completedCount).toBe(7);
  });

  it("points blocked screening to the transunion connect action", () => {
    const result = deriveLandlordActivationSummary(
      buildSnapshot({
        propertyCount: 1,
        unitCount: 1,
        applicationCount: 1,
        viewingCount: 1,
        primaryApplicationId: "app-1",
      })
    );

    const screening = result.steps.find((step) => step.key === "screening");
    expect(screening?.status).toBe("blocked");
    expect(screening?.actionLabel).toBe("Connect TransUnion");
    expect(screening?.actionPath).toContain("openTransUnionConnect=1");
  });
});
