import type { SharePackageCategoryView } from "./sharePackageAlignment";
import type { LeaseFlowTransitionView } from "./leaseFlowTransitionState";
import type { LandlordDecisionOutcomeView } from "./landlordDecisionOutcome";
import type { TenantWorkspaceLease } from "../api/tenantPortal";

export type LeasePreparationWorkspaceState =
  | "not_started"
  | "preparing_lease"
  | "needs_attention"
  | "ready_for_execution"
  | "awaiting_next_action";

export type LeasePreparationWorkspaceItem = {
  key: string;
  label: string;
  detail: string;
};

export type LeasePreparationWorkspaceView = {
  preparationState: LeasePreparationWorkspaceState;
  label: string;
  summary: string;
  explanation: string;
  completedItems: LeasePreparationWorkspaceItem[];
  outstandingItems: LeasePreparationWorkspaceItem[];
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

function hasLeaseDocument(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.documentUrl || "").trim());
}

function stateLabel(state: LeasePreparationWorkspaceState): string {
  if (state === "ready_for_execution") return "Ready for execution";
  if (state === "preparing_lease") return "Preparing lease";
  if (state === "needs_attention") return "Needs attention";
  if (state === "awaiting_next_action") return "Awaiting next action";
  return "Not started";
}

function completedCategoryItems(
  packageCategories: SharePackageCategoryView[]
): LeasePreparationWorkspaceItem[] {
  return packageCategories
    .filter((item) => item.status !== "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail:
        item.status === "ready"
          ? `${item.label} is visible and ready in the current workflow state.`
          : `${item.label} is partly visible and can still support lease preparation review.`,
    }));
}

function outstandingCategoryItems(
  packageCategories: SharePackageCategoryView[]
): LeasePreparationWorkspaceItem[] {
  return packageCategories
    .filter((item) => item.status === "missing")
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail: item.detail,
    }));
}

function timelineForState(
  state: LeasePreparationWorkspaceState
): LeasePreparationWorkspaceView["timelineEvent"] {
  if (state === "preparing_lease") {
    return {
      title: "Lease preparation started",
      description:
        "The lease step is visible and the current preparation checklist is now in progress.",
      actionRequired: false,
    };
  }
  if (state === "needs_attention") {
    return {
      title: "Lease preparation updated",
      description:
        "Visible preparation items still need attention before the lease can move forward.",
      actionRequired: true,
    };
  }
  if (state === "ready_for_execution") {
    return {
      title: "Lease preparation ready for execution",
      description:
        "The currently visible preparation items appear organized enough for the next lease execution step.",
      actionRequired: false,
    };
  }
  if (state === "awaiting_next_action") {
    return {
      title: "Lease preparation awaiting next action",
      description:
        "The file looks ready to begin lease preparation, and the next supported action is still pending.",
      actionRequired: false,
    };
  }
  return null;
}

export function buildLeasePreparationWorkspaceState(input: {
  audience: "landlord" | "tenant";
  decisionOutcome: LandlordDecisionOutcomeView;
  leaseTransition: LeaseFlowTransitionView;
  packageCategories: SharePackageCategoryView[];
  lease?: TenantWorkspaceLease | null;
}): LeasePreparationWorkspaceView {
  const lease = input.lease || null;
  const outstandingItems = outstandingCategoryItems(input.packageCategories);
  const completedItems = completedCategoryItems(input.packageCategories);
  const leaseVisible = hasLeaseProjection(lease);
  const leaseDocumentVisible = hasLeaseDocument(lease);
  const leaseReady = input.decisionOutcome.outcomeState === "ready_for_next_step";
  const baseCompleted: LeasePreparationWorkspaceItem[] = leaseReady
    ? [
        ...completedItems,
        {
          key: "decision_outcome",
          label: "Application outcome",
          detail: "The current decision outcome appears ready for the next supported step.",
        },
      ]
    : completedItems;

  if (input.leaseTransition.transitionState === "not_ready_for_lease") {
    return {
      preparationState: "not_started",
      label: stateLabel("not_started"),
      summary: "Lease preparation",
      explanation:
        "Lease preparation has not started because the application is not yet ready to move beyond the current decision and follow-up workflow.",
      completedItems: completedItems,
      outstandingItems: [
        ...outstandingItems,
        {
          key: "lease_step",
          label: "Lease step readiness",
          detail: "The lease step has not started because the current application outcome is not ready yet.",
        },
      ],
      blockers: input.leaseTransition.blockers,
      nextActions:
        input.audience === "landlord"
          ? [
              "Finish the remaining review and follow-up work before starting lease preparation.",
              "Return to this workspace after the application is ready for the next step.",
            ]
          : [
              "Finish the remaining application updates that are still visible in your tenant workspace.",
              "Check back once the landlord has moved the file into the next supported step.",
            ],
      timelineEvent: null,
    };
  }

  if (outstandingItems.length > 0) {
    return {
      preparationState: "needs_attention",
      label: stateLabel("needs_attention"),
      summary: "Lease preparation",
      explanation:
        "Lease preparation can move forward only after the remaining visible package gaps are addressed.",
      completedItems: baseCompleted,
      outstandingItems: [
        ...outstandingItems,
        {
          key: "lease_transition",
          label: "Lease step readiness",
          detail:
            input.leaseTransition.transitionState === "lease_step_started"
              ? "A lease-related record is visible, but the remaining preparation items still need attention."
              : "The file is approaching lease preparation, but the remaining visible items still need attention first.",
        },
      ],
      blockers: outstandingItems.map((item) => `${item.label} still needs attention before lease preparation can settle.`),
      nextActions:
        input.audience === "landlord"
          ? [
              "Review the outstanding package categories and keep lease preparation read-first until those items are clearer.",
              "Use the existing lease workflow only after the missing visible items are stronger.",
            ]
          : [
              "Address the remaining package items that still show as missing before the lease can move forward.",
              "Keep your documents, access, and profile current while the next lease step is being prepared.",
            ],
      timelineEvent: timelineForState("needs_attention"),
    };
  }

  if (!leaseVisible) {
    return {
      preparationState: "awaiting_next_action",
      label: stateLabel("awaiting_next_action"),
      summary: "Lease preparation",
      explanation:
        "The visible package appears ready for lease preparation, but no lease-preparation record is surfaced in the current workspace yet.",
      completedItems: [
        ...baseCompleted,
        {
          key: "lease_transition",
          label: "Lease step readiness",
          detail: "The file now appears ready to move into lease preparation.",
        },
      ],
      outstandingItems: [
        {
          key: "lease_record",
          label: "Lease preparation record",
          detail:
            input.audience === "landlord"
              ? "A lease-preparation record is not visible from the current review-summary surface yet."
              : "A lease-preparation record is not visible in your tenant workspace yet.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Start the next supported lease-preparation action from the existing lease workflow when you are ready.",
              "Use this checklist to confirm the file stays organized while the lease step begins.",
            ]
          : [
              "Watch for the next lease-preparation update in your tenant workspace.",
              "Keep your current profile and supporting records available in case anything else needs confirmation.",
            ],
      timelineEvent: timelineForState("awaiting_next_action"),
    };
  }

  if (!leaseDocumentVisible) {
    return {
      preparationState: "preparing_lease",
      label: stateLabel("preparing_lease"),
      summary: "Lease preparation",
      explanation:
        "Lease preparation is in progress because a lease-related record is visible, but the visible preparation checklist is not fully assembled yet.",
      completedItems: [
        ...baseCompleted,
        {
          key: "lease_record",
          label: "Lease preparation record",
          detail: "A lease-related record is visible in the current authorized workspace.",
        },
      ],
      outstandingItems: [
        {
          key: "lease_document",
          label: "Lease document availability",
          detail:
            input.audience === "landlord"
              ? "The review-summary workspace does not show a completed lease document yet."
              : "A lease document is not visible in your tenant workspace yet.",
        },
      ],
      blockers: [],
      nextActions:
        input.audience === "landlord"
          ? [
              "Continue the supported lease-preparation work in the existing lease workflow.",
              "Return here to confirm when the visible preparation items are ready for the next step.",
            ]
          : [
              "Watch for the lease document or next preparation update in your tenant workspace.",
              "Review any newly visible lease details once they appear.",
            ],
      timelineEvent: timelineForState("preparing_lease"),
    };
  }

  return {
    preparationState: "ready_for_execution",
    label: stateLabel("ready_for_execution"),
    summary: "Lease preparation",
    explanation:
      "The currently visible preparation items appear organized enough for the next supported lease execution step.",
    completedItems: [
      ...baseCompleted,
      {
        key: "lease_record",
        label: "Lease preparation record",
        detail: "A lease-related record is visible in the current authorized workspace.",
      },
      {
        key: "lease_document",
        label: "Lease document availability",
        detail: "A lease document is already visible in the current workspace.",
      },
    ],
    outstandingItems: [],
    blockers: [],
    nextActions:
      input.audience === "landlord"
        ? [
            "Continue to the next supported execution step in the existing lease workflow.",
            "Keep any final execution or signing actions inside the current lease tools rather than this read-first workspace.",
          ]
        : [
            "Review the visible lease details and watch for the next supported execution instruction.",
            "Use your lease workspace if you need to revisit the currently visible lease information.",
          ],
    timelineEvent: timelineForState("ready_for_execution"),
  };
}
