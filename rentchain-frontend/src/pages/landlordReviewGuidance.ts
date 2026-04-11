import type { LandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";
import { buildTenantLandlordInteractionLoop } from "./tenantLandlordInteractionLoop";

export type LandlordReviewGuidanceState =
  | "follow_up_needed"
  | "partly_addressed"
  | "ready_for_rereview";

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
  const state: LandlordReviewGuidanceState = loop.state;

  return {
    state,
    summary: loop.headline,
    explanation: loop.detail,
    nextSteps: loop.nextSteps,
    missingCategories: loop.followUpCategories,
  };
}
