import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";
import type { SharePackageCategoryView } from "./sharePackageAlignment";
import { buildFollowUpResolutionState } from "./followUpResolutionState";

export type LandlordDecisionWorkspaceState =
  | "needs_follow_up"
  | "hold_for_later"
  | "ready_for_decision";

export type LandlordDecisionWorkspaceView = {
  decisionState: LandlordDecisionWorkspaceState;
  statusLabel: string;
  summary: string;
  explanation: string;
  blockers: string[];
  nextSteps: string[];
  missingCategories: string[];
};

function screeningComplete(status: string | null | undefined): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "complete" || normalized === "completed";
}

function buildHoldBlockers(summary: ApplicationReviewSummary): string[] {
  const blockers: string[] = [];
  const completeness = Math.round(summary.derived.completeness.score * 100);

  if (summary.derived.flags.length > 0) {
    blockers.push(
      `${summary.derived.flags.length} high-level intake gap${summary.derived.flags.length === 1 ? "" : "s"} still appear in the current review summary.`
    );
  }

  if (completeness < 80) {
    blockers.push(`Application readiness is ${completeness}% complete in the current review summary.`);
  }

  if (summary.decisionSummary?.screeningRecommendation?.recommended) {
    blockers.push("Screening is still recommended before moving this file to a final landlord next step.");
  } else if (!screeningComplete(summary.screening.status) && !summary.decisionSummary?.screeningSummary?.available) {
    blockers.push("Screening is not yet complete, so this file may still need more review context.");
  }

  return blockers;
}

export function buildLandlordDecisionWorkspace(params: {
  summary: ApplicationReviewSummary;
  packageCategories: SharePackageCategoryView[];
}): LandlordDecisionWorkspaceView {
  const resolution = buildFollowUpResolutionState(params.packageCategories);
  const missingCategories = resolution.remainingCategoriesNeedingAttention;

  if (resolution.overallState !== "ready_for_rereview") {
    return {
      decisionState: "needs_follow_up",
      statusLabel: "Needs follow-up",
      summary: "Decision workspace",
      explanation:
        "This application is not ready for a landlord next-step decision yet because follow-up is still open in the current authorized package.",
      blockers: missingCategories.map(
        (category) => `${category} still needs follow-up before this file can move forward.`
      ),
      nextSteps: [
        "Keep follow-up active in the aligned package categories until the missing areas are updated.",
        "Review the package again after the visible follow-up categories have been addressed.",
      ],
      missingCategories,
    };
  }

  const holdBlockers = buildHoldBlockers(params.summary);
  if (holdBlockers.length > 0) {
    return {
      decisionState: "hold_for_later",
      statusLabel: "Hold for later",
      summary: "Decision workspace",
      explanation:
        "Follow-up appears complete enough for re-review, but this file should stay in review until the remaining summary signals are clearer.",
      blockers: holdBlockers,
      nextSteps: [
        "Keep this file in review while the remaining readiness and screening signals are clarified.",
        "Return to the review summary after the outstanding review items are stronger or more complete.",
      ],
      missingCategories: [],
    };
  }

  return {
    decisionState: "ready_for_decision",
    statusLabel: "Ready for decision",
    summary: "Decision workspace",
    explanation:
      "The current authorized package no longer shows open follow-up, and the available review signals are organized enough for a landlord next-step decision.",
    blockers: [],
    nextSteps: [
      "Use this review summary to guide your next landlord decision step without relying on automation.",
      "Capture any internal decision note or operational next step separately from this read-first workspace.",
    ],
    missingCategories: [],
  };
}
