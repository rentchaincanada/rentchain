import type { SharePackageCategoryView } from "./sharePackageAlignment";
import type { LeasePreparationWorkspaceView } from "./leasePreparationWorkspaceState";
import type { LeaseFlowTransitionView } from "./leaseFlowTransitionState";
import type { LandlordDecisionOutcomeView } from "./landlordDecisionOutcome";
import type { TenantWorkspaceLease } from "../api/tenantPortal";

export type MoveInReadinessWorkspaceState =
  | "not_started"
  | "in_progress"
  | "needs_attention"
  | "ready_for_move_in"
  | "awaiting_next_action";

export type MoveInReadinessWorkspaceItem = {
  key: string;
  label: string;
  detail: string;
};

export type MoveInReadinessWorkspaceView = {
  readinessState: MoveInReadinessWorkspaceState;
  label: string;
  summary: string;
  explanation: string;
  completedItems: MoveInReadinessWorkspaceItem[];
  outstandingItems: MoveInReadinessWorkspaceItem[];
  blockers: string[];
  nextActions: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  } | null;
};

function stateLabel(state: MoveInReadinessWorkspaceState): string {
  if (state === "ready_for_move_in") return "Ready for move-in";
  if (state === "in_progress") return "Preparing for move-in";
  if (state === "needs_attention") return "Needs attention";
  if (state === "awaiting_next_action") return "Awaiting next action";
  return "Not started";
}

function timelineForState(
  state: MoveInReadinessWorkspaceState
): MoveInReadinessWorkspaceView["timelineEvent"] {
  if (state === "in_progress") {
    return {
      title: "Move-in readiness started",
      description:
        "The visible lease and preparation details now support a structured move-in readiness view.",
      actionRequired: false,
    };
  }
  if (state === "needs_attention") {
    return {
      title: "Move-in readiness updated",
      description:
        "Visible move-in requirements still need attention before the file appears ready for move-in.",
      actionRequired: true,
    };
  }
  if (state === "awaiting_next_action") {
    return {
      title: "Move-in readiness updated",
      description:
        "The file is approaching move-in readiness, and the next visible move-in step is still pending.",
      actionRequired: false,
    };
  }
  if (state === "ready_for_move_in") {
    return {
      title: "Ready for move-in",
      description:
        "The currently visible move-in requirements appear organized enough for the next move-in step.",
      actionRequired: false,
    };
  }
  return null;
}

function visibleLeaseDetailsItem(
  lease: TenantWorkspaceLease | null | undefined
): MoveInReadinessWorkspaceItem | null {
  if (!lease) return null;
  const details = [
    lease.startDate ? `Start ${lease.startDate}` : null,
    lease.endDate ? `End ${lease.endDate}` : null,
    typeof lease.monthlyRent === "number" ? `Rent ${lease.monthlyRent}` : null,
  ].filter(Boolean);
  if (!details.length) return null;
  return {
    key: "lease_details",
    label: "Lease details",
    detail: `Current lease details are visible in the workspace (${details.join(" • ")}).`,
  };
}

function completedCategoryItems(
  packageCategories: SharePackageCategoryView[]
): MoveInReadinessWorkspaceItem[] {
  return packageCategories
    .filter((item) => item.status !== "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail:
        item.status === "ready"
          ? `${item.label} is visible and organized for move-in readiness review.`
          : `${item.label} is partly visible and can still support move-in readiness review.`,
    }));
}

function outstandingCategoryItems(
  packageCategories: SharePackageCategoryView[]
): MoveInReadinessWorkspaceItem[] {
  return packageCategories
    .filter((item) => item.status === "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail: item.detail,
    }));
}

export function buildMoveInReadinessWorkspaceState(input: {
  audience: "landlord" | "tenant";
  decisionOutcome: LandlordDecisionOutcomeView;
  leaseTransition: LeaseFlowTransitionView;
  leasePreparation: LeasePreparationWorkspaceView;
  packageCategories: SharePackageCategoryView[];
  lease?: TenantWorkspaceLease | null;
}): MoveInReadinessWorkspaceView {
  const lease = input.lease || null;
  const categoryCompleted = completedCategoryItems(input.packageCategories);
  const categoryOutstanding = outstandingCategoryItems(input.packageCategories);
  const leaseDetails = visibleLeaseDetailsItem(lease);
  const leaseVisible = Boolean(String(lease?.leaseId || "").trim() || String(lease?.status || "").trim());
  const leaseDocumentVisible = Boolean(String(lease?.documentUrl || "").trim());

  const completedItems: MoveInReadinessWorkspaceItem[] = [
    ...categoryCompleted,
    {
      key: "decision_outcome",
      label: "Application outcome",
      detail:
        input.decisionOutcome.outcomeState === "ready_for_next_step"
          ? "The current application outcome is ready for the next supported step."
          : "The current application outcome is still earlier in the workflow.",
    },
  ];

  if (input.leaseTransition.transitionState === "lease_step_started") {
    completedItems.push({
      key: "lease_step_started",
      label: "Lease step",
      detail: "The lease step has started in the current visible workflow.",
    });
  }

  if (leaseDetails) {
    completedItems.push(leaseDetails);
  }

  if (leaseDocumentVisible) {
    completedItems.push({
      key: "lease_document",
      label: "Lease document visibility",
      detail: "A lease document is already visible in the current workspace.",
    });
  }

  if (
    input.leaseTransition.transitionState === "not_ready_for_lease" ||
    input.leasePreparation.preparationState === "not_started"
  ) {
    return {
      readinessState: "not_started",
      label: stateLabel("not_started"),
      summary: "Move-in readiness",
      explanation:
        "Move-in readiness has not started because the file has not reached a stable lease or preparation stage yet.",
      completedItems: categoryCompleted,
      outstandingItems: [
        ...categoryOutstanding,
        {
          key: "lease_stage",
          label: "Lease and preparation stage",
          detail:
            "The lease step and preparation workflow need to progress further before move-in readiness can be organized.",
        },
      ],
      blockers: [
        ...input.leaseTransition.blockers,
        ...input.leasePreparation.blockers,
      ],
      nextActions:
        input.audience === "landlord"
          ? [
              "Keep the current review, follow-up, and lease-preparation steps organized before starting move-in readiness.",
              "Return to this workspace once the lease step is visibly underway.",
            ]
          : [
              "Finish the current application and lease-preparation items that are still visible in your tenant workspace.",
              "Check back once the next lease step is available.",
            ],
      timelineEvent: null,
    };
  }

  if (
    input.leasePreparation.preparationState === "needs_attention" ||
    categoryOutstanding.length > 0
  ) {
    return {
      readinessState: "needs_attention",
      label: stateLabel("needs_attention"),
      summary: "Move-in readiness",
      explanation:
        "Some visible move-in requirements still need attention before this file appears ready for move-in.",
      completedItems,
      outstandingItems: [
        ...categoryOutstanding,
        ...input.leasePreparation.outstandingItems,
      ],
      blockers: [
        ...input.leasePreparation.blockers,
        ...categoryOutstanding.map((item) => `${item.label} still needs attention before move-in readiness settles.`),
      ],
      nextActions:
        input.audience === "landlord"
          ? [
              "Review the remaining lease-preparation and package items before treating this tenancy as ready for move-in.",
              "Use the checklist below to keep the next landlord step structured and visible.",
            ]
          : [
              "Address the remaining visible items before move-in readiness can look complete.",
              "Use your profile, documents, access, and lease views to keep the file current.",
            ],
      timelineEvent: timelineForState("needs_attention"),
    };
  }

  if (input.leasePreparation.preparationState === "awaiting_next_action" || !leaseVisible) {
    return {
      readinessState: "awaiting_next_action",
      label: stateLabel("awaiting_next_action"),
      summary: "Move-in readiness",
      explanation:
        "The file appears organized enough to begin move-in readiness, but the next visible move-in step has not surfaced yet.",
      completedItems,
      outstandingItems: [
        {
          key: "move_in_record",
          label: "Move-in readiness step",
          detail:
            input.audience === "landlord"
              ? "A distinct move-in readiness record is not visible from the current review-summary surface yet."
              : "A distinct move-in readiness step is not visible in your tenant workspace yet.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Use the current lease and preparation views to keep the file organized while the move-in step is still pending.",
              "Return here when more move-in-ready details are visible.",
            ]
          : [
              "Watch for the next move-in update in your tenant workspace.",
              "Keep your current lease and supporting records available in case anything else needs confirmation.",
            ],
      timelineEvent: timelineForState("awaiting_next_action"),
    };
  }

  if (!leaseDocumentVisible) {
    return {
      readinessState: "in_progress",
      label: stateLabel("in_progress"),
      summary: "Move-in readiness",
      explanation:
        "Move-in readiness is in progress because the lease and preparation workflow are visible, but the visible move-in checklist is still forming.",
      completedItems,
      outstandingItems: [
        {
          key: "lease_document_visibility",
          label: "Lease document visibility",
          detail:
            input.audience === "landlord"
              ? "A visible lease document is not yet surfaced from the current review-summary context."
              : "A visible lease document is not yet available in your tenant workspace.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Continue preparing the current lease details and keep move-in requirements organized in this shared checklist.",
              "Use the visible lease tools to confirm the remaining move-in information as it becomes available.",
            ]
          : [
              "Continue reviewing the current lease details and watch for the next move-in update.",
              "Keep your profile, documents, and access details current while move-in preparation continues.",
            ],
      timelineEvent: timelineForState("in_progress"),
    };
  }

  return {
    readinessState: "ready_for_move_in",
    label: stateLabel("ready_for_move_in"),
    summary: "Move-in readiness",
    explanation:
      "The visible move-in requirements now appear organized enough for the next move-in step.",
    completedItems,
    outstandingItems: [],
    blockers: [],
    nextActions:
      input.audience === "landlord"
        ? [
            "Use the current lease and tenant operations tools to manage the next move-in step.",
            "Keep this checklist as the shared view for any remaining operational confirmations.",
          ]
        : [
            "Review the visible lease details and keep an eye on your tenant workspace for the next move-in update.",
            "Use your current tenant tools if anything needs another look before move-in.",
          ],
    timelineEvent: timelineForState("ready_for_move_in"),
  };
}
