import type { SharePackageCategoryView } from "./sharePackageAlignment";
import type { LandlordDecisionOutcomeView } from "./landlordDecisionOutcome";
import type { LeasePreparationWorkspaceView } from "./leasePreparationWorkspaceState";
import type { MoveInReadinessWorkspaceView } from "./moveInReadinessWorkspaceState";
import type { TenantWorkspaceLease } from "../api/tenantPortal";

export type LeaseExecutionReadinessState =
  | "not_ready_for_execution"
  | "preparing_for_execution"
  | "needs_attention"
  | "ready_for_execution"
  | "awaiting_next_action";

export type LeaseExecutionReadinessItem = {
  key: string;
  label: string;
  detail: string;
};

export type LeaseExecutionReadinessView = {
  readinessState: LeaseExecutionReadinessState;
  label: string;
  summary: string;
  explanation: string;
  completedItems: LeaseExecutionReadinessItem[];
  outstandingItems: LeaseExecutionReadinessItem[];
  blockers: string[];
  nextActions: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  } | null;
};

function stateLabel(state: LeaseExecutionReadinessState): string {
  if (state === "ready_for_execution") return "Ready for execution";
  if (state === "preparing_for_execution") return "Preparing to proceed";
  if (state === "needs_attention") return "Needs attention";
  if (state === "awaiting_next_action") return "Awaiting final requirements";
  return "Not ready for execution";
}

function timelineForState(
  state: LeaseExecutionReadinessState
): LeaseExecutionReadinessView["timelineEvent"] {
  if (state === "preparing_for_execution") {
    return {
      title: "Lease execution readiness started",
      description:
        "The current lease and move-in details now support a final pre-execution readiness view.",
      actionRequired: false,
    };
  }
  if (state === "needs_attention") {
    return {
      title: "Lease execution readiness updated",
      description:
        "Visible execution-readiness blockers still need attention before the file can move forward.",
      actionRequired: true,
    };
  }
  if (state === "awaiting_next_action") {
    return {
      title: "Lease execution readiness updated",
      description:
        "The file looks close to execution readiness, and the next visible execution-related step is still pending.",
      actionRequired: false,
    };
  }
  if (state === "ready_for_execution") {
    return {
      title: "Ready for execution",
      description:
        "The currently visible execution-readiness requirements appear organized enough for the next supported step.",
      actionRequired: false,
    };
  }
  return null;
}

function visibleLease(lease: TenantWorkspaceLease | null | undefined): boolean {
  if (!lease) return false;
  return Boolean(String(lease.leaseId || "").trim() || String(lease.status || "").trim());
}

function visibleLeaseDocument(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.documentUrl || "").trim());
}

function completedCategoryItems(
  packageCategories: SharePackageCategoryView[]
): LeaseExecutionReadinessItem[] {
  return packageCategories
    .filter((item) => item.status !== "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail:
        item.status === "ready"
          ? `${item.label} is visible and organized for final execution-readiness review.`
          : `${item.label} is partly visible and can still support final execution-readiness review.`,
    }));
}

function outstandingCategoryItems(
  packageCategories: SharePackageCategoryView[]
): LeaseExecutionReadinessItem[] {
  return packageCategories
    .filter((item) => item.status === "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail: item.detail,
    }));
}

export function buildLeaseExecutionReadinessState(input: {
  audience: "landlord" | "tenant";
  decisionOutcome: LandlordDecisionOutcomeView;
  leasePreparation: LeasePreparationWorkspaceView;
  moveInReadiness: MoveInReadinessWorkspaceView;
  packageCategories: SharePackageCategoryView[];
  lease?: TenantWorkspaceLease | null;
}): LeaseExecutionReadinessView {
  const lease = input.lease || null;
  const leaseVisible = visibleLease(lease);
  const leaseDocumentVisible = visibleLeaseDocument(lease);
  const categoryCompleted = completedCategoryItems(input.packageCategories);
  const categoryOutstanding = outstandingCategoryItems(input.packageCategories);
  const completedItems: LeaseExecutionReadinessItem[] = [
    ...categoryCompleted,
    {
      key: "application_outcome",
      label: "Application outcome",
      detail:
        input.decisionOutcome.outcomeState === "ready_for_next_step"
          ? "The current application outcome is ready for the next supported step."
          : "The current application outcome is still earlier in the workflow.",
    },
  ];

  if (input.leasePreparation.preparationState === "ready_for_execution") {
    completedItems.push({
      key: "lease_preparation",
      label: "Lease preparation",
      detail: "The current visible lease-preparation requirements appear organized enough to proceed.",
    });
  }

  if (input.moveInReadiness.readinessState === "ready_for_move_in") {
    completedItems.push({
      key: "move_in_readiness",
      label: "Move-in readiness",
      detail: "The visible move-in readiness requirements appear organized enough for the next step.",
    });
  }

  if (leaseVisible) {
    completedItems.push({
      key: "lease_record",
      label: "Lease record",
      detail: "A lease-related record is visible in the current authorized workspace.",
    });
  }

  if (leaseDocumentVisible) {
    completedItems.push({
      key: "lease_document",
      label: "Lease document visibility",
      detail: "A lease document is visible in the current authorized workspace.",
    });
  }

  if (
    input.decisionOutcome.outcomeState !== "ready_for_next_step" ||
    input.leasePreparation.preparationState === "not_started" ||
    input.moveInReadiness.readinessState === "not_started"
  ) {
    return {
      readinessState: "not_ready_for_execution",
      label: stateLabel("not_ready_for_execution"),
      summary: "Lease execution readiness",
      explanation:
        "Lease execution readiness has not started because the file has not yet reached a stable preparation and move-in stage.",
      completedItems: categoryCompleted,
      outstandingItems: [
        ...categoryOutstanding,
        {
          key: "execution_stage",
          label: "Execution-readiness stage",
          detail:
            "The lease-preparation and move-in readiness stages need to advance further before this file can appear ready to move forward.",
        },
      ],
      blockers: [
        ...input.decisionOutcome.blockers,
        ...input.leasePreparation.blockers,
        ...input.moveInReadiness.blockers,
      ],
      nextActions:
        input.audience === "landlord"
          ? [
              "Keep the current decision, lease-preparation, and move-in readiness steps organized before treating this file as ready to move forward.",
              "Return to this view once the visible preparation stages are further along.",
            ]
          : [
              "Finish the current tenant-visible preparation and move-in items before expecting the file to move forward.",
              "Check back once the next lease-related stage appears in your tenant workspace.",
            ],
      timelineEvent: null,
    };
  }

  if (
    input.leasePreparation.preparationState === "needs_attention" ||
    input.moveInReadiness.readinessState === "needs_attention" ||
    categoryOutstanding.length > 0
  ) {
    return {
      readinessState: "needs_attention",
      label: stateLabel("needs_attention"),
      summary: "Lease execution readiness",
      explanation:
        "Some visible final-stage requirements still need attention before this file appears ready to move forward.",
      completedItems,
      outstandingItems: [
        ...categoryOutstanding,
        ...input.leasePreparation.outstandingItems,
        ...input.moveInReadiness.outstandingItems,
      ],
      blockers: [
        ...input.leasePreparation.blockers,
        ...input.moveInReadiness.blockers,
        ...categoryOutstanding.map((item) => `${item.label} still needs attention before execution readiness settles.`),
      ],
      nextActions:
        input.audience === "landlord"
          ? [
              "Review the remaining visible blockers before moving the file into any execution-related step.",
              "Use the checklist below to keep the final pre-execution phase structured and explainable.",
            ]
          : [
              "Address the remaining visible items before the lease can move forward.",
              "Keep your profile, documents, access, and lease details current while the final checks are still open.",
            ],
      timelineEvent: timelineForState("needs_attention"),
    };
  }

  if (input.moveInReadiness.readinessState === "awaiting_next_action" || !leaseVisible) {
    return {
      readinessState: "awaiting_next_action",
      label: stateLabel("awaiting_next_action"),
      summary: "Lease execution readiness",
      explanation:
        "The file appears close to ready, but the next visible execution-related step has not surfaced yet.",
      completedItems,
      outstandingItems: [
        {
          key: "execution_workspace",
          label: "Execution-readiness step",
          detail:
            input.audience === "landlord"
              ? "A distinct execution-readiness record is not visible from the current review-summary surface yet."
              : "A distinct execution-readiness step is not visible in your tenant workspace yet.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Keep the current lease and move-in details organized while the next supported execution step is still pending.",
              "Return here when more final-stage details are visible.",
            ]
          : [
              "Watch for the next execution-readiness update in your tenant workspace.",
              "Keep your current lease details available in case anything else needs confirmation.",
            ],
      timelineEvent: timelineForState("awaiting_next_action"),
    };
  }

  if (
    input.moveInReadiness.readinessState === "in_progress" ||
    input.leasePreparation.preparationState === "preparing_lease" ||
    !leaseDocumentVisible
  ) {
    return {
      readinessState: "preparing_for_execution",
      label: stateLabel("preparing_for_execution"),
      summary: "Lease execution readiness",
      explanation:
        "Execution readiness is taking shape because the visible lease and move-in requirements are organized, but the final pre-execution checklist is still forming.",
      completedItems,
      outstandingItems: [
        {
          key: "final_execution_signal",
          label: "Final execution-readiness signal",
          detail:
            leaseDocumentVisible
              ? "The visible file is close to ready, but the last execution-readiness confirmation has not surfaced yet."
              : input.audience === "landlord"
              ? "A visible lease document is not yet surfaced from the current review-summary context."
              : "A visible lease document is not yet available in your tenant workspace.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Continue organizing the current lease and move-in requirements before moving the file forward.",
              "Use the existing lease workflow for any follow-on execution-related tools once they are visible.",
            ]
          : [
              "Continue reviewing your current lease details and wait for the next tenant-visible update.",
              "Keep your supporting records available while the final pre-execution steps continue.",
            ],
      timelineEvent: timelineForState("preparing_for_execution"),
    };
  }

  return {
    readinessState: "ready_for_execution",
    label: stateLabel("ready_for_execution"),
    summary: "Lease execution readiness",
    explanation:
      "The visible final-stage requirements now appear organized enough for the next supported execution-related step.",
    completedItems,
    outstandingItems: [],
    blockers: [],
    nextActions:
      input.audience === "landlord"
        ? [
            "Use the current lease workflow for the next supported execution-related step.",
            "Keep this readiness view as the shared checklist for any final operational confirmations.",
          ]
        : [
            "Review the visible lease details and watch for the next tenant-visible instruction.",
            "Keep your current workspace details handy in case anything needs one final check.",
          ],
    timelineEvent: timelineForState("ready_for_execution"),
  };
}
