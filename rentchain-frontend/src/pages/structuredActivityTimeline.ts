import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";
import type { TenantNotificationItem } from "../api/tenantNotifications";
import { buildLandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";
import { buildLandlordDecisionWorkspace } from "./landlordDecisionWorkspace";
import { buildLandlordDecisionOutcome } from "./landlordDecisionOutcome";
import { buildLeaseFlowTransitionState } from "./leaseFlowTransitionState";
import { buildLeasePreparationWorkspaceState } from "./leasePreparationWorkspaceState";
import { buildMoveInReadinessWorkspaceState } from "./moveInReadinessWorkspaceState";
import { buildLeaseExecutionReadinessState } from "./leaseExecutionReadinessState";
import { buildLeaseExecutionWorkspace } from "./leaseExecutionWorkspace";

export type StructuredActivityTimelineItem = {
  id: string;
  type:
    | "profile_updated"
    | "documents_updated"
    | "access_updated"
    | "follow_up_requested"
    | "ready_for_review"
    | "ready_for_rereview"
    | "application_updated"
    | "review_updated"
    | "message"
    | "maintenance"
    | "invite"
    | "identity_updated"
    | "system";
  title: string;
  description: string;
  occurredAt: number;
  actorLabel: string | null;
  actionRequired: boolean;
  relatedPath: string | null;
};

function toMillis(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeTenantType(
  item: TenantNotificationItem
): StructuredActivityTimelineItem["type"] {
  switch (item.type) {
    case "application":
      return "application_updated";
    case "identity":
      return "identity_updated";
    case "document":
      return "documents_updated";
    case "lease":
      return "review_updated";
    case "maintenance":
      return "maintenance";
    case "message":
      return "message";
    case "invite":
      return "invite";
    default:
      return "system";
  }
}

export function buildTenantStructuredActivityTimeline(
  items: TenantNotificationItem[]
): StructuredActivityTimelineItem[] {
  return [...items]
    .map((item) => ({
      id: item.id,
      type: normalizeTenantType(item),
      title: item.title,
      description: item.summary,
      occurredAt: toMillis(item.createdAt) || 0,
      actorLabel:
        item.type === "message"
          ? "Landlord"
          : item.type === "system"
          ? "System"
          : "Tenant workspace",
      actionRequired: item.status === "warning",
      relatedPath: item.relatedPath,
    }))
    .sort((left, right) => right.occurredAt - left.occurredAt);
}

function pushTimelineItem(
  items: StructuredActivityTimelineItem[],
  next: Omit<StructuredActivityTimelineItem, "occurredAt"> & { occurredAt: string | number | null | undefined }
) {
  const occurredAt = toMillis(next.occurredAt);
  if (!occurredAt) return;
  items.push({
    ...next,
    occurredAt,
  });
}

export function buildLandlordStructuredActivityTimeline(
  summary: ApplicationReviewSummary
): StructuredActivityTimelineItem[] {
  const items: StructuredActivityTimelineItem[] = [];
  const missingCategories = summary.derived.flags.length;
  const completeness = Math.round(summary.derived.completeness.score * 100);
  const intakeView = buildLandlordIntakeAlignmentView(summary);
  const decisionWorkspace = buildLandlordDecisionWorkspace({
    summary,
    packageCategories: intakeView.packageCategories,
  });
  const decisionOutcome = buildLandlordDecisionOutcome({
    decisionStatus: summary.decisionSummary?.status || null,
    decisionWorkspace,
    followUpOverallState:
      decisionWorkspace.decisionState === "ready_for_decision"
        ? "ready_for_rereview"
        : decisionWorkspace.decisionState === "needs_follow_up"
        ? "follow_up_needed"
        : "partly_addressed",
    remainingCategories: intakeView.packageCategories.filter((item) => item.status === "missing"),
  });
  const leaseTransition = buildLeaseFlowTransitionState({
    audience: "landlord",
    decisionOutcome,
  });
  const leasePreparation = buildLeasePreparationWorkspaceState({
    audience: "landlord",
    decisionOutcome,
    leaseTransition,
    packageCategories: intakeView.packageCategories,
  });
  const moveInReadiness = buildMoveInReadinessWorkspaceState({
    audience: "landlord",
    decisionOutcome,
    leaseTransition,
    leasePreparation,
    packageCategories: intakeView.packageCategories,
  });
  const executionWorkspace = buildLeaseExecutionWorkspace({
    audience: "landlord",
    executionReadiness: buildLeaseExecutionReadinessState({
      audience: "landlord",
      decisionOutcome,
      leasePreparation,
      moveInReadiness,
      packageCategories: intakeView.packageCategories,
    }),
  });

  pushTimelineItem(items, {
    id: `review-summary-${summary.applicationId}`,
    type: missingCategories > 0 ? "follow_up_requested" : "ready_for_review",
    title: missingCategories > 0 ? "Follow-up requested" : "Ready for review",
    description:
      missingCategories > 0
        ? `${missingCategories} category gap${missingCategories === 1 ? "" : "s"} still need attention in the current review summary.`
        : `The current review summary is organized and ready to review at ${completeness}% completeness.`,
    occurredAt: summary.generatedAt,
    actorLabel: "Review summary",
    actionRequired: missingCategories > 0,
    relatedPath: null,
  });

  pushTimelineItem(items, {
    id: `application-readiness-${summary.applicationId}`,
    type: missingCategories > 0 ? "ready_for_rereview" : "application_updated",
    title: "Application readiness updated",
    description:
      missingCategories > 0
        ? `Application readiness is ${completeness}% complete and is waiting on follow-up before re-review.`
        : `Application readiness is ${completeness}% complete with no current category gaps surfaced.`,
    occurredAt: summary.generatedAt,
    actorLabel: "Tenant package",
    actionRequired: missingCategories > 0,
    relatedPath: null,
  });

  pushTimelineItem(items, {
    id: `consent-${summary.applicationId}`,
    type: "review_updated",
    title: summary.compliance.signedAt ? "Consent / identity status updated" : "Consent / identity status pending",
    description: summary.compliance.signedAt
      ? "Consent and signature records are available in the current review package."
      : "Consent or signature records are still limited in the current review package.",
    occurredAt: summary.compliance.signedAt || summary.generatedAt,
    actorLabel: "Tenant package",
    actionRequired: !summary.compliance.signedAt,
    relatedPath: null,
  });

  if (summary.screening.status && summary.screening.status !== "not_run") {
    pushTimelineItem(items, {
      id: `screening-${summary.applicationId}`,
      type: "review_updated",
      title: "Review state updated",
      description: summary.screening.provider
        ? `Screening status is ${summary.screening.status} through ${summary.screening.provider}.`
        : `Screening status is ${summary.screening.status}.`,
      occurredAt: summary.decisionSummary?.riskSnapshot?.updatedAt || summary.generatedAt,
      actorLabel: "Review summary",
      actionRequired: false,
      relatedPath: null,
    });
  }

  if (summary.decisionSummary?.riskSnapshot?.updatedAt) {
    pushTimelineItem(items, {
      id: `risk-${summary.applicationId}`,
      type: missingCategories > 0 ? "follow_up_requested" : "review_updated",
      title: missingCategories > 0 ? "Review follow-up remains active" : "Review summary refreshed",
      description: missingCategories > 0
        ? "The latest review snapshot still shows categories that need follow-up."
        : "The latest review snapshot reflects the current application package.",
      occurredAt: summary.decisionSummary.riskSnapshot.updatedAt,
      actorLabel: "Review summary",
      actionRequired: missingCategories > 0,
      relatedPath: null,
    });
  }

  pushTimelineItem(items, {
    id: `decision-outcome-${summary.applicationId}`,
    type: decisionOutcome.outcomeState === "ready_for_next_step" ? "ready_for_rereview" : "review_updated",
    title: decisionOutcome.timelineEvent.title,
    description: decisionOutcome.timelineEvent.description,
    occurredAt:
      summary.decisionSummary?.riskSnapshot?.updatedAt ||
      summary.generatedAt,
    actorLabel: decisionOutcome.source === "explicit" ? "Decision workspace" : "Derived review state",
    actionRequired: decisionOutcome.timelineEvent.actionRequired,
    relatedPath: null,
  });

  if (leaseTransition.timelineEvent) {
    pushTimelineItem(items, {
      id: `lease-transition-${summary.applicationId}`,
      type: leaseTransition.transitionState === "ready_for_lease_step" ? "ready_for_rereview" : "review_updated",
      title: leaseTransition.timelineEvent.title,
      description: leaseTransition.timelineEvent.description,
      occurredAt:
        summary.decisionSummary?.riskSnapshot?.updatedAt ||
        summary.generatedAt,
      actorLabel: "Decision workspace",
      actionRequired: leaseTransition.timelineEvent.actionRequired,
      relatedPath: null,
    });
  }

  if (leasePreparation.timelineEvent) {
    pushTimelineItem(items, {
      id: `lease-preparation-${summary.applicationId}`,
      type:
        leasePreparation.preparationState === "ready_for_execution"
          ? "ready_for_rereview"
          : "review_updated",
      title: leasePreparation.timelineEvent.title,
      description: leasePreparation.timelineEvent.description,
      occurredAt:
        summary.decisionSummary?.riskSnapshot?.updatedAt ||
        summary.generatedAt,
      actorLabel: "Lease preparation",
      actionRequired: leasePreparation.timelineEvent.actionRequired,
      relatedPath: null,
    });
  }

  if (moveInReadiness.timelineEvent) {
    pushTimelineItem(items, {
      id: `move-in-readiness-${summary.applicationId}`,
      type:
        moveInReadiness.readinessState === "ready_for_move_in"
          ? "ready_for_rereview"
          : "review_updated",
      title: moveInReadiness.timelineEvent.title,
      description: moveInReadiness.timelineEvent.description,
      occurredAt:
        summary.decisionSummary?.riskSnapshot?.updatedAt ||
        summary.generatedAt,
      actorLabel: "Move-in readiness",
      actionRequired: moveInReadiness.timelineEvent.actionRequired,
      relatedPath: null,
    });
  }

  if (executionWorkspace.timelineEvent) {
    pushTimelineItem(items, {
      id: `lease-execution-readiness-${summary.applicationId}`,
      type:
        executionWorkspace.executionState === "ready_for_execution" ||
        executionWorkspace.executionState === "execution_in_progress"
          ? "ready_for_rereview"
          : "review_updated",
      title: executionWorkspace.timelineEvent.title,
      description: executionWorkspace.timelineEvent.description,
      occurredAt:
        summary.decisionSummary?.riskSnapshot?.updatedAt ||
        summary.generatedAt,
      actorLabel: "Lease execution readiness",
      actionRequired: executionWorkspace.timelineEvent.actionRequired,
      relatedPath: null,
    });
  }

  return items.sort((left, right) => right.occurredAt - left.occurredAt);
}
