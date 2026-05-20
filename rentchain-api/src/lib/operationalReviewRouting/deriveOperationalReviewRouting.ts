import crypto from "crypto";
import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";
import type { BuildReviewWorkspaceInput, ReviewWorkspacePriority, ReviewWorkspaceType } from "../reviewWorkspaces/reviewWorkspaceTypes";
import type {
  OperationalReviewReasonKey,
  OperationalReviewResourceRefInput,
  OperationalReviewRoutingCategory,
  OperationalReviewRoutingDecision,
  OperationalReviewRoutingInput,
  OperationalReviewRoutingSeverity,
  OperationalReviewRoutingStatus,
} from "./operationalReviewRoutingTypes";
import { OPERATIONAL_REVIEW_ROUTING_VERSION } from "./operationalReviewRoutingTypes";

const INACTIVE_STATUSES = new Set(["resolved", "dismissed", "informational"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanIdPart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function lower(value: unknown): string {
  return asString(value, 500).toLowerCase();
}

function safeLabel(value: unknown, fallback: string): string {
  const raw = asString(value, 180).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return raw || fallback;
}

function reviewReasonLabel(reason: OperationalReviewReasonKey): string {
  if (reason === "delinquency_review") return "Delinquency review";
  if (reason === "payment_evidence_review") return "Payment evidence review";
  if (reason === "screening_review") return "Screening review";
  if (reason === "lease_execution_review") return "Lease execution review";
  if (reason === "document_review") return "Document review";
  if (reason === "occupancy_review") return "Occupancy review";
  if (reason === "evidence_review") return "Evidence review";
  if (reason === "informational_not_reviewable") return "Informational only";
  return "Operational anomaly review";
}

function priorityLabel(priority: ReviewWorkspacePriority): string {
  if (priority === "critical") return "Critical review";
  if (priority === "warning") return "Warning review";
  if (priority === "needs_review") return "Needs review";
  if (priority === "upcoming") return "Upcoming review";
  return "Informational";
}

function priorityFromInput(input: OperationalReviewRoutingInput): ReviewWorkspacePriority {
  const severity = lower(input.severity);
  const escalation = lower(input.escalationLevel);
  const status = lower(input.status);
  if (severity === "critical" || severity === "high" || escalation === "critical" || escalation === "urgent") {
    return "critical";
  }
  if (status === "blocked" || severity === "medium" || escalation === "attention") return "warning";
  if (input.category === "lease_lifecycle" || input.category === "occupancy") return "upcoming";
  if (severity === "info" || status === "informational") return "info";
  return "needs_review";
}

function reasonFromInput(input: OperationalReviewRoutingInput): OperationalReviewReasonKey {
  const haystack = [
    input.itemId,
    input.title,
    input.description,
    input.category,
    input.workflowQueue,
    input.workflowState,
    input.reviewStatus,
    input.financialStatus,
  ]
    .map(lower)
    .join(" ");

  if (INACTIVE_STATUSES.has(lower(input.status)) || input.category === "operations" && lower(input.severity) === "info") {
    return "informational_not_reviewable";
  }
  if (input.category === "evidence" || haystack.includes("evidence_pack")) return "evidence_review";
  if (input.category === "screening" || haystack.includes("screening")) return "screening_review";
  if (input.category === "documents" || haystack.includes("document") || haystack.includes("signature")) return "document_review";
  if (input.category === "occupancy" || haystack.includes("occupancy") || haystack.includes("vacancy")) return "occupancy_review";
  if (haystack.includes("delinquen") || haystack.includes("overdue") || haystack.includes("missing_payment")) {
    return "delinquency_review";
  }
  if (input.category === "payments" || haystack.includes("payment") || haystack.includes("ledger")) {
    return "payment_evidence_review";
  }
  if (input.category === "lease_lifecycle" || haystack.includes("lease")) return "lease_execution_review";
  return "operational_anomaly_review";
}

function workspaceTypeFromReason(reason: OperationalReviewReasonKey): ReviewWorkspaceType {
  if (reason === "delinquency_review") return "delinquency_review";
  if (reason === "payment_evidence_review") return "payment_ledger_review";
  if (reason === "screening_review") return "screening_review";
  if (reason === "document_review" || reason === "lease_execution_review") return "document_review";
  if (reason === "evidence_review") return "evidence_review";
  return "operational_anomaly_review";
}

function routingId(input: { landlordId: string; itemId: string; reason: OperationalReviewReasonKey }) {
  const clean = cleanIdPart(["review_routing", input.landlordId, input.reason, input.itemId].join(":"));
  return clean || `review_routing:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function normalizeRelatedResourceRefs(input: OperationalReviewRoutingInput): OperationalReviewResourceRefInput[] {
  const refs = Array.isArray(input.relatedResourceRefs) ? input.relatedResourceRefs : [];
  const scoped = refs
    .map((ref) => ({
      resourceType: asString(ref.resourceType, 80),
      resourceId: asString(ref.resourceId, 240),
      label: safeLabel(ref.label, "Operational resource"),
      landlordId: asString(ref.landlordId, 240) || null,
      tenantId: asString(ref.tenantId, 240) || null,
      propertyId: asString(ref.propertyId, 240) || null,
      unitId: asString(ref.unitId, 240) || null,
      leaseId: asString(ref.leaseId, 240) || null,
    }))
    .filter((ref) => ref.resourceType && ref.resourceId)
    .filter((ref) => !ref.landlordId || ref.landlordId === input.landlordId)
    .filter((ref) => !input.tenantId || !ref.tenantId || ref.tenantId === input.tenantId);
  const byKey = new Map<string, OperationalReviewResourceRefInput>();
  for (const ref of scoped) {
    const key = `${ref.resourceType}:${ref.resourceId}`;
    if (!byKey.has(key)) byKey.set(key, ref);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.resourceType}:${a.resourceId}`.localeCompare(`${b.resourceType}:${b.resourceId}`)
  );
}

export function deriveOperationalReviewRouting(input: OperationalReviewRoutingInput): OperationalReviewRoutingDecision {
  const itemId = asString(input.itemId, 500);
  const landlordId = asString(input.landlordId, 240);
  if (!itemId || !landlordId) throw new Error("operational_review_routing_scope_required");

  const reason = reasonFromInput(input);
  const reviewPriority = priorityFromInput(input);
  const reviewEligible = reason !== "informational_not_reviewable" && !INACTIVE_STATUSES.has(lower(input.status));
  return {
    routingId: routingId({ landlordId, itemId, reason }),
    routingVersion: OPERATIONAL_REVIEW_ROUTING_VERSION,
    itemId,
    landlordId,
    reviewEligible,
    reviewReasonKey: reason,
    reviewReasonLabel: reviewReasonLabel(reason),
    reviewPriority,
    priorityLabel: priorityLabel(reviewPriority),
    workspaceType: workspaceTypeFromReason(reason),
    workspaceScopeId: itemId,
    manualOnly: true,
    autoCreateWorkspace: false,
    autonomousActionsEnabled: false,
    permissionWideningRequired: false,
    sourceDestination: asString(input.destination, 500) || null,
    relatedResourceRefs: normalizeRelatedResourceRefs(input),
  };
}

export function deriveOperationalReviewRoutingFromDecision(
  decision: DecisionInboxItem,
  scope: { landlordId: string; tenantId?: string | null }
): OperationalReviewRoutingDecision {
  const relatedResourceRefs: OperationalReviewResourceRefInput[] = decision.relatedEntity
    ? [
        {
          resourceType: decision.relatedEntity.kind === "maintenance_request" ? "document" : decision.relatedEntity.kind,
          resourceId: decision.relatedEntity.id,
          label: decision.relatedEntity.label,
          landlordId: scope.landlordId,
          tenantId: scope.tenantId || null,
        },
      ]
    : [];
  return deriveOperationalReviewRouting({
    itemId: decision.id,
    landlordId: scope.landlordId,
    tenantId: scope.tenantId || null,
    title: decision.title,
    description: decision.description,
    category: categoryFromDecision(decision),
    severity: decision.severity as OperationalReviewRoutingSeverity,
    status: decision.status as OperationalReviewRoutingStatus,
    workflowQueue: decision.workflow?.queue,
    workflowState: decision.workflow?.workflowState,
    escalationLevel: decision.workflow?.escalationLevel,
    reviewStatus: decision.workflow?.reviewPriority,
    destination: decision.destination,
    relatedResourceRefs,
  });
}

function categoryFromDecision(decision: DecisionInboxItem): OperationalReviewRoutingCategory {
  if (decision.workflow?.queue === "delinquency_review" || decision.type === "billing") return "payments";
  if (decision.workflow?.queue === "screening_review" || decision.type === "screening") return "screening";
  if (decision.workflow?.queue === "lease_review" || decision.type === "lease") return "lease_lifecycle";
  if (decision.workflow?.queue === "maintenance_review" || decision.type === "maintenance") return "operations";
  if (decision.workflow?.queue === "admin_review" || decision.type === "admin") return "review_workflow";
  return "review_workflow";
}

export function buildReviewWorkspaceInputFromRouting(input: {
  routing: OperationalReviewRoutingDecision;
  createdBy: BuildReviewWorkspaceInput["createdBy"];
  createdAt?: string | Date | null;
}): BuildReviewWorkspaceInput | null {
  if (!input.routing.reviewEligible) return null;
  return {
    workspaceType: input.routing.workspaceType,
    workspaceScopeId: input.routing.workspaceScopeId,
    landlordId: input.routing.landlordId,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    reviewPriority: input.routing.reviewPriority,
    reviewStatus: "open",
    relatedResourceRefs: input.routing.relatedResourceRefs,
    reviewSummary: input.routing.reviewReasonLabel,
    reviewTags: [input.routing.reviewReasonKey, input.routing.reviewPriority],
  };
}
