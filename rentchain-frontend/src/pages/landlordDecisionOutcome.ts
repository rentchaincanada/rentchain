import type { LandlordDecisionWorkspaceView } from "./landlordDecisionWorkspace";
import type { FollowUpResolutionOverallState, FollowUpResolutionCategoryView } from "./followUpResolutionState";

export type LandlordDecisionOutcomeState =
  | "ready_for_next_step"
  | "hold_for_later"
  | "not_proceeding";

export type LandlordDecisionOutcomeView = {
  outcomeState: LandlordDecisionOutcomeState;
  label: string;
  source: "explicit" | "derived";
  sourceLabel: string;
  description: string;
  tenantDescription: string;
  blockers: string[];
  landlordNextSteps: string[];
  tenantNextSteps: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  };
};

function normalizeExplicitOutcomeState(
  raw: string | null | undefined
): LandlordDecisionOutcomeState | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;

  if (
    [
      "ready_for_next_step",
      "ready for next step",
      "ready_for_decision",
      "approved",
      "approve",
      "proceed",
      "proceeding",
    ].includes(value)
  ) {
    return "ready_for_next_step";
  }

  if (
    [
      "hold_for_later",
      "hold for later",
      "hold",
      "on_hold",
      "on hold",
      "request_info",
      "request info",
      "in_review",
      "decision_in_progress",
    ].includes(value)
  ) {
    return "hold_for_later";
  }

  if (
    [
      "not_proceeding",
      "not proceeding",
      "declined",
      "decline",
      "rejected",
      "reject",
      "closed_not_proceeding",
    ].includes(value)
  ) {
    return "not_proceeding";
  }

  return null;
}

function outcomeLabel(state: LandlordDecisionOutcomeState): string {
  if (state === "ready_for_next_step") return "Ready for next step";
  if (state === "not_proceeding") return "Not proceeding";
  return "Hold for later";
}

function withFallbackSteps(steps: string[], fallback: string[]): string[] {
  return steps.length ? steps : fallback;
}

export function buildLandlordDecisionOutcome(input: {
  decisionStatus?: string | null;
  decisionWorkspace?: LandlordDecisionWorkspaceView | null;
  followUpOverallState?: FollowUpResolutionOverallState | null;
  remainingCategories?: FollowUpResolutionCategoryView[] | string[];
}): LandlordDecisionOutcomeView {
  const explicitState = normalizeExplicitOutcomeState(input.decisionStatus);
  const unresolvedCategoryLabels = (input.remainingCategories || []).map((item) =>
    typeof item === "string" ? item : item.label
  );
  const decisionWorkspace = input.decisionWorkspace || null;
  const followUpOverallState = input.followUpOverallState || null;

  if (explicitState === "ready_for_next_step") {
    return {
      outcomeState: explicitState,
      label: outcomeLabel(explicitState),
      source: "explicit",
      sourceLabel: "Current outcome record",
      description:
        "A landlord decision outcome is currently recorded as ready for next step in the authorized review context.",
      tenantDescription:
        "Your application is currently marked ready for the next step.",
      blockers: [],
      landlordNextSteps: [
        "Continue the next landlord step using your existing operating process outside this read-first review summary.",
        "Keep any final operational notes separate from this structured outcome view.",
      ],
      tenantNextSteps: [
        "Watch for the landlord’s next-step instructions or follow-on workflow.",
        "Keep your profile and documents current in case anything needs to be confirmed again.",
      ],
      timelineEvent: {
        title: "Application marked Ready for next step",
        description:
          "The current decision outcome is recorded as ready for the next landlord step.",
        actionRequired: false,
      },
    };
  }

  if (explicitState === "hold_for_later") {
    return {
      outcomeState: explicitState,
      label: outcomeLabel(explicitState),
      source: "explicit",
      sourceLabel: "Current outcome record",
      description:
        "A landlord decision outcome is currently recorded as hold for later while this file remains in review.",
      tenantDescription:
        "Your application is currently on hold while the landlord completes the next review step.",
      blockers: decisionWorkspace?.blockers || unresolvedCategoryLabels,
      landlordNextSteps: withFallbackSteps(decisionWorkspace?.nextSteps || [], [
        "Keep the file on hold until the remaining review context is clear enough for a next-step decision.",
      ]),
      tenantNextSteps: [
        "Keep an eye on any follow-up or review updates that appear in your tenant workspace.",
      ],
      timelineEvent: {
        title: "Application placed on hold",
        description: "The current decision outcome is recorded as hold for later.",
        actionRequired: false,
      },
    };
  }

  if (explicitState === "not_proceeding") {
    return {
      outcomeState: explicitState,
      label: outcomeLabel(explicitState),
      source: "explicit",
      sourceLabel: "Current outcome record",
      description:
        "A landlord decision outcome is currently recorded as not proceeding in the authorized review context.",
      tenantDescription:
        "Your application is currently marked as not proceeding.",
      blockers: [],
      landlordNextSteps: [
        "Keep any final compliance or communication actions in the appropriate workflow outside this review summary.",
      ],
      tenantNextSteps: [
        "Review the latest application updates in your tenant workspace for any next instructions that are already visible to you.",
      ],
      timelineEvent: {
        title: "Application not proceeding",
        description: "The current decision outcome is recorded as not proceeding.",
        actionRequired: false,
      },
    };
  }

  if (decisionWorkspace?.decisionState === "ready_for_decision") {
    return {
      outcomeState: "ready_for_next_step",
      label: outcomeLabel("ready_for_next_step"),
      source: "derived",
      sourceLabel: "Derived from current review state",
      description:
        "The current review, follow-up, and re-review signals now appear organized enough for the next landlord step.",
      tenantDescription:
        "Your application currently appears ready for the next step after re-review.",
      blockers: [],
      landlordNextSteps: [
        "Use the review summary and structured outcome view to guide your next landlord step.",
        "Capture any final recorded outcome separately if a dedicated persistence path is added later.",
      ],
      tenantNextSteps: [
        "Your file currently looks ready for the next landlord step.",
        "Keep your profile and supporting documents available in case anything needs to be reconfirmed.",
      ],
      timelineEvent: {
        title: "Application aligned as Ready for next step",
        description:
          "The current authorized review state now appears ready for the next landlord step.",
        actionRequired: false,
      },
    };
  }

  const followUpStillOpen =
    followUpOverallState === "follow_up_needed" || followUpOverallState === "partly_addressed";
  const blockers = decisionWorkspace?.blockers?.length
    ? decisionWorkspace.blockers
    : unresolvedCategoryLabels.map((label) =>
        `${label} still needs follow-up before this file can move forward.`
      );

  return {
    outcomeState: "hold_for_later",
    label: outcomeLabel("hold_for_later"),
    source: "derived",
    sourceLabel: "Derived from current review state",
    description: followUpStillOpen
      ? "Follow-up or re-review is still active, so this application remains on hold for now."
      : "This application should stay on hold until the remaining review context is clearer.",
    tenantDescription: followUpStillOpen
      ? "Your application still has open follow-up or re-review work before it can move forward."
      : "Your application is still on hold while the landlord finishes reviewing the current file.",
    blockers,
    landlordNextSteps: withFallbackSteps(decisionWorkspace?.nextSteps || [], [
      "Keep this file in review until the remaining follow-up and readiness signals are clearer.",
    ]),
    tenantNextSteps: followUpStillOpen
      ? [
          "Finish any remaining follow-up areas that still need attention in your tenant workspace.",
          "Review the package again after the visible follow-up items are addressed.",
        ]
      : ["Keep an eye on your tenant workspace for any follow-up or next-step updates."],
    timelineEvent: {
      title: followUpStillOpen ? "Application placed on hold" : "Application currently held for later",
      description: followUpStillOpen
        ? "The current review state still has follow-up or re-review work before a next-step outcome."
        : "The current review state is still on hold while the remaining context is clarified.",
      actionRequired: followUpStillOpen,
    },
  };
}
