import type { LandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";
import { buildTenantLandlordInteractionLoop } from "./tenantLandlordInteractionLoop";

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
  const loop = buildTenantLandlordInteractionLoop({
    audience: "landlord",
    packageCategories: intake.packageCategories,
  });
  const state: LandlordReviewGuidanceState =
    loop.state === "ready_for_review"
      ? "ready_to_review"
      : loop.state === "ready_for_rereview"
      ? "partly_available"
      : "needs_follow_up";

  return {
    state,
    summary: loop.headline,
    explanation: loop.detail,
    nextSteps: loop.nextSteps,
    missingCategories: loop.followUpCategories,
  };
}
