import type { LandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";

export type LandlordReviewGuidanceState =
  | "ready_to_review"
  | "partly_available"
  | "needs_follow_up";

export type LandlordReviewGuidanceView = {
  state: LandlordReviewGuidanceState;
  summary: string;
  explanation: string;
  nextSteps: string[];
  missingCategories: string[];
};

export function buildLandlordReviewGuidance(
  intake: LandlordIntakeAlignmentView
): LandlordReviewGuidanceView {
  const readyCount = intake.packageCategories.filter((item) => item.status === "ready").length;
  const partialCount = intake.packageCategories.filter((item) => item.status === "partial").length;
  const missingCategories = intake.packageCategories
    .filter((item) => item.status === "missing")
    .map((item) => item.label);

  let state: LandlordReviewGuidanceState = "ready_to_review";
  if (missingCategories.length > 0) {
    state = readyCount > 0 || partialCount > 0 ? "partly_available" : "needs_follow_up";
  } else if (partialCount > 0) {
    state = "partly_available";
  }

  const nextSteps: string[] = [];
  if (readyCount > 0) {
    nextSteps.push("Review the categories already available now before following up on anything else.");
  }
  if (missingCategories.length > 0) {
    nextSteps.push(
      `Follow up on missing information in ${missingCategories.join(", ")} before final review.`
    );
  }
  if (partialCount > 0) {
    nextSteps.push("Confirm the partly available sections so the review record stays complete and consistent.");
  }
  if (nextSteps.length === 0) {
    nextSteps.push("Review the available package sections and document your final decision in the summary.");
  }

  if (state === "ready_to_review") {
    return {
      state,
      summary: "Ready to review",
      explanation:
        "The current package is organized enough to review now, and no major category gaps are surfaced from the authorized summary.",
      nextSteps,
      missingCategories,
    };
  }

  if (state === "partly_available") {
    return {
      state,
      summary: "Partly available",
      explanation:
        "Some sections are available to review now, but a few package categories still need follow-up before the file feels complete.",
      nextSteps,
      missingCategories,
    };
  }

  return {
    state,
    summary: "Needs follow-up",
    explanation:
      "The current package is still missing too many categories for a confident review, so follow-up is the next step.",
    nextSteps,
    missingCategories,
  };
}
