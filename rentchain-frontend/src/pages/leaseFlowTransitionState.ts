import type { TenantWorkspaceLease } from "../api/tenantPortal";
import type { LandlordDecisionOutcomeView } from "./landlordDecisionOutcome";

export type LeaseFlowTransitionState =
  | "not_ready_for_lease"
  | "ready_for_lease_step"
  | "lease_step_started"
  | "awaiting_next_action";

export type LeaseFlowTransitionView = {
  transitionState: LeaseFlowTransitionState;
  label: string;
  summary: string;
  explanation: string;
  blockers: string[];
  nextActions: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  } | null;
};

function hasLeaseProjection(lease: TenantWorkspaceLease | null | undefined): boolean {
  if (!lease) return false;
  return Boolean(String(lease.leaseId || "").trim() || String(lease.status || "").trim());
}

function isTenantAudience(audience: "landlord" | "tenant") {
  return audience === "tenant";
}

export function buildLeaseFlowTransitionState(input: {
  audience: "landlord" | "tenant";
  decisionOutcome: LandlordDecisionOutcomeView;
  lease?: TenantWorkspaceLease | null;
}): LeaseFlowTransitionView {
  const lease = input.lease || null;
  const leaseVisible = hasLeaseProjection(lease);

  if (leaseVisible) {
    return {
      transitionState: "lease_step_started",
      label: "Lease step started",
      summary: "Lease transition",
      explanation:
        "A lease-related record is already visible in the current authorized workspace, so the post-decision transition has started.",
      blockers: [],
      nextActions: isTenantAudience(input.audience)
        ? [
            "Open your lease workspace to review the current lease-step information that is already available to you.",
            "Wait for any additional lease-preparation instructions that appear in your tenant workspace.",
          ]
        : [
            "Continue the lease preparation work using the current lease tools already available in the product.",
            "Keep lease drafting or follow-on lease actions in the appropriate lease workflow rather than this review summary.",
          ],
      timelineEvent: {
        title: "Lease step started",
        description:
          "A lease-related record is now visible in the current authorized workspace.",
        actionRequired: false,
      },
    };
  }

  if (input.decisionOutcome.outcomeState !== "ready_for_next_step") {
    return {
      transitionState: "not_ready_for_lease",
      label: "Not ready for lease step",
      summary: "Lease transition",
      explanation:
        "This application is not ready to move into the lease step yet because the current decision outcome has not reached the next-step stage.",
      blockers: input.decisionOutcome.blockers,
      nextActions: input.decisionOutcome.outcomeState === "not_proceeding"
        ? [
            "No lease-step transition is shown because the current outcome is not proceeding.",
          ]
        : [
            "Complete the remaining review and decision work before moving this file into the lease step.",
            "Return to the lease transition view after the application outcome is ready for the next step.",
          ],
      timelineEvent: null,
    };
  }

  if (isTenantAudience(input.audience)) {
    return {
      transitionState: "awaiting_next_action",
      label: "Awaiting next lease action",
      summary: "Lease transition",
      explanation:
        "The application outcome is ready for the next step, but no lease-step record is visible in your tenant workspace yet.",
      blockers: [],
      nextActions: [
        "Watch for the next lease-preparation update in your tenant workspace.",
        "Keep your profile and documents current in case the next step needs anything else from you.",
      ],
      timelineEvent: {
        title: "Awaiting next lease action",
        description:
          "The application outcome is ready, and the next lease-related action has not appeared in the tenant workspace yet.",
        actionRequired: false,
      },
    };
  }

  return {
    transitionState: "ready_for_lease_step",
    label: "Ready for lease step",
    summary: "Lease transition",
    explanation:
      "The current application outcome is ready for the next step, and this file now appears ready to move into the lease flow.",
    blockers: [],
    nextActions: [
      "Move this file into the lease flow using the current lease tools already supported in the product.",
      "Keep lease drafting or activation actions in the existing lease workflow rather than this review summary.",
    ],
    timelineEvent: {
      title: "Application marked ready for lease step",
      description:
        "The current application outcome now appears ready to move into the lease step.",
      actionRequired: false,
    },
  };
}
