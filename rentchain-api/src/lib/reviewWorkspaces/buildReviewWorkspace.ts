import crypto from "crypto";
import type { OperatorReviewOpenRequest, OperatorReviewScope } from "../operatorReviews/operatorReviewTypes";
import {
  REVIEW_WORKSPACE_CONTRACT_VERSION,
  type BuildReviewWorkspaceInput,
  type ReviewWorkspace,
  type ReviewWorkspaceAuditRef,
  type ReviewWorkspaceEventRef,
  type ReviewWorkspaceEvidenceRef,
  type ReviewWorkspacePriority,
  type ReviewWorkspaceResourceRef,
  type ReviewWorkspaceResourceType,
  type ReviewWorkspaceReviewer,
  type ReviewWorkspaceSensitivityClass,
  type ReviewWorkspaceStatus,
  type ReviewWorkspaceType,
  type ReviewWorkspaceVisibilityClass,
} from "./reviewWorkspaceTypes";

const VALID_WORKSPACE_TYPES = new Set<ReviewWorkspaceType>([
  "evidence_review",
  "payment_ledger_review",
  "screening_review",
  "operational_anomaly_review",
  "document_review",
  "delinquency_review",
]);

const VALID_STATUSES = new Set<ReviewWorkspaceStatus>(["open", "under_review", "blocked", "completed", "escalated"]);
const VALID_PRIORITIES = new Set<ReviewWorkspacePriority>(["critical", "warning", "needs_review", "upcoming", "info"]);
const VALID_SENSITIVITY = new Set<ReviewWorkspaceSensitivityClass>(["sensitive", "restricted"]);
const VALID_VISIBILITY = new Set<ReviewWorkspaceVisibilityClass>(["landlord_operational", "admin_support"]);
const VALID_EVIDENCE_TYPES = new Set(["evidence_pack", "evidence_item", "source_reference"]);
const VALID_RESOURCE_TYPES = new Set<ReviewWorkspaceResourceType>([
  "lease",
  "tenant",
  "property",
  "unit",
  "payment",
  "ledger_entry",
  "screening_order",
  "document",
  "decision",
  "canonical_event",
  "evidence_pack",
]);

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

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function safeText(value: unknown, max = 1000): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function evidenceRefId(input: {
  evidencePackId: string;
  evidenceItemId?: string | null;
  sourceCollection?: string | null;
  sourceId?: string | null;
}): string {
  const clean = cleanIdPart(
    [
      "review_evidence_ref",
      input.evidencePackId,
      input.evidenceItemId || "pack",
      input.sourceCollection || "source",
      input.sourceId || "unknown",
    ].join(":")
  );
  return clean || `review_evidence_ref:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function workspaceTypeLabel(value: ReviewWorkspaceType): string {
  if (value === "evidence_review") return "Evidence review";
  if (value === "payment_ledger_review") return "Payment ledger review";
  if (value === "screening_review") return "Screening review";
  if (value === "operational_anomaly_review") return "Operational anomaly review";
  if (value === "document_review") return "Document review";
  return "Delinquency review";
}

export function reviewWorkspaceId(input: {
  landlordId: string;
  workspaceType: ReviewWorkspaceType;
  workspaceScopeId: string;
}): string {
  const clean = cleanIdPart(["review_workspace", input.landlordId, input.workspaceType, input.workspaceScopeId].join(":"));
  return clean || `review_workspace:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

export function normalizeReviewWorkspaceReviewer(raw: unknown): ReviewWorkspaceReviewer {
  const data = (raw || {}) as Record<string, unknown>;
  const role = asString(data.role, 40).toLowerCase();
  return {
    userId: asString(data.userId || data.actorId || data.id, 240) || null,
    role: role === "admin" || role === "operator" ? role : "landlord",
    email: asString(data.email, 320) || null,
  };
}

export function normalizeReviewWorkspaceEvidenceRefs(
  raw: unknown,
  scope: { landlordId: string; tenantId?: string | null }
): ReviewWorkspaceEvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const evidencePackId = asString(data.evidencePackId || data.evidenceId || data.id, 240);
      const label = safeText(data.label, 160);
      const sensitivityClass = asString(data.sensitivityClass, 40) as ReviewWorkspaceSensitivityClass;
      const evidenceType = asString(data.evidenceType || data.type, 80);
      const sourceCollection = asString(data.sourceCollection, 120) || null;
      const sourceId = asString(data.sourceId, 240) || null;
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!evidencePackId || !label) return null;
      if (landlordId && landlordId !== scope.landlordId) return null;
      if (scope.tenantId && tenantId && tenantId !== scope.tenantId) return null;
      return {
        evidenceRefId:
          asString(data.evidenceRefId, 240) ||
          evidenceRefId({
            evidencePackId,
            evidenceItemId: asString(data.evidenceItemId, 240) || null,
            sourceCollection,
            sourceId,
          }),
        evidencePackId,
        evidenceItemId: asString(data.evidenceItemId, 240) || null,
        evidenceType: VALID_EVIDENCE_TYPES.has(evidenceType) ? (evidenceType as ReviewWorkspaceEvidenceRef["evidenceType"]) : "evidence_pack",
        label,
        sourceCollection,
        sourceId,
        sourceRef: sourceCollection && sourceId ? { sourceCollection, sourceId } : null,
        scopeType: asString(data.scopeType || data.scope, 120) || null,
        scopeId: asString(data.scopeId, 240) || null,
        landlordId,
        tenantId,
        sensitivityClass: VALID_SENSITIVITY.has(sensitivityClass) ? sensitivityClass : "sensitive",
        projectionProfile: asString(data.projectionProfile || data.profileName, 120) || null,
        projectionVersion: asString(data.projectionVersion || data.profileVersion, 120) || null,
        redactionSummary: safeText(data.redactionSummary, 500) || null,
        lineageSummary: safeText(data.lineageSummary, 500) || null,
      };
    })
    .filter(Boolean) as ReviewWorkspaceEvidenceRef[];

  const byKey = new Map<string, ReviewWorkspaceEvidenceRef>();
  for (const ref of refs) {
    const key = [ref.evidencePackId, ref.evidenceItemId || "", ref.sourceCollection || "", ref.sourceId || ""].join(":");
    if (!byKey.has(key)) byKey.set(key, ref);
  }
  return Array.from(byKey.values())
    .sort((a, b) => `${a.evidencePackId}:${a.evidenceItemId || ""}`.localeCompare(`${b.evidencePackId}:${b.evidenceItemId || ""}`))
    .slice(0, 24);
}

export function normalizeReviewWorkspaceResourceRefs(
  raw: unknown,
  scope: { landlordId: string; tenantId?: string | null }
): ReviewWorkspaceResourceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const resourceType = asString(data.resourceType || data.type, 80) as ReviewWorkspaceResourceType;
      const resourceId = asString(data.resourceId || data.id, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null;
      if (landlordId && landlordId !== scope.landlordId) return null;
      if (scope.tenantId && tenantId && tenantId !== scope.tenantId) return null;
      return {
        resourceType,
        resourceId,
        label: safeText(data.label, 160) || `${resourceType.replace(/_/g, " ")} reference`,
        landlordId,
        tenantId,
        propertyId: asString(data.propertyId, 240) || null,
        unitId: asString(data.unitId, 240) || null,
        leaseId: asString(data.leaseId, 240) || null,
      };
    })
    .filter(Boolean) as ReviewWorkspaceResourceRef[];

  const byKey = new Map<string, ReviewWorkspaceResourceRef>();
  for (const ref of refs) byKey.set(`${ref.resourceType}:${ref.resourceId}`, ref);
  return Array.from(byKey.values())
    .sort((a, b) => `${a.resourceType}:${a.resourceId}`.localeCompare(`${b.resourceType}:${b.resourceId}`))
    .slice(0, 32);
}

export function normalizeReviewWorkspaceEventRef(raw: unknown): ReviewWorkspaceEventRef | null {
  const data = (raw || {}) as Record<string, unknown>;
  const eventId = asString(data.eventId || data.id, 240);
  const eventType = asString(data.eventType || data.type, 160);
  if (!eventId || !eventType) return null;
  return {
    eventId,
    eventType,
    sourceSystem: asString(data.sourceSystem, 120) || null,
  };
}

export function normalizeReviewWorkspaceAuditRefs(raw: unknown): ReviewWorkspaceAuditRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const auditId = asString(data.auditId || data.eventId || data.id, 240);
      const eventType = asString(data.eventType || data.type, 160);
      if (!auditId || !eventType) return null;
      return {
        auditId,
        eventType,
        sourceCollection: asString(data.sourceCollection, 120) || null,
      };
    })
    .filter(Boolean) as ReviewWorkspaceAuditRef[];
  const byKey = new Map<string, ReviewWorkspaceAuditRef>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection || "audit"}:${ref.auditId}`, ref);
  return Array.from(byKey.values()).sort((a, b) => a.auditId.localeCompare(b.auditId)).slice(0, 24);
}

export function buildReviewWorkspace(input: BuildReviewWorkspaceInput): ReviewWorkspace {
  const workspaceType = VALID_WORKSPACE_TYPES.has(input.workspaceType) ? input.workspaceType : "operational_anomaly_review";
  const workspaceScopeId = asString(input.workspaceScopeId, 500);
  const landlordId = asString(input.landlordId, 240);
  if (!workspaceScopeId || !landlordId) {
    throw new Error("review_workspace_scope_required");
  }

  const createdAt = toIsoDate(input.createdAt) || new Date().toISOString();
  const reviewStatus = asString(input.reviewStatus, 40) as ReviewWorkspaceStatus;
  const reviewPriority = asString(input.reviewPriority, 40) as ReviewWorkspacePriority;
  const sensitivityClass = asString(input.sensitivityClass, 40) as ReviewWorkspaceSensitivityClass;
  const visibilityClass = asString(input.visibilityClass, 40) as ReviewWorkspaceVisibilityClass;
  const evidenceRefs = normalizeReviewWorkspaceEvidenceRefs(input.evidenceRefs, {
    landlordId,
    tenantId: input.tenantId,
  });
  const relatedResourceRefs = normalizeReviewWorkspaceResourceRefs(input.relatedResourceRefs, {
    landlordId,
    tenantId: input.tenantId,
  });
  const reviewNotes = Array.isArray(input.reviewNotes)
    ? input.reviewNotes.map((note) => safeText(note, 1000)).filter(Boolean).slice(0, 20)
    : [];
  const reviewTags = uniqueSorted(
    (Array.isArray(input.reviewTags) ? input.reviewTags : [])
      .map((tag) => cleanIdPart(tag).replace(/:/g, "_"))
      .filter(Boolean)
  ).slice(0, 20);

  return {
    workspaceId: reviewWorkspaceId({ landlordId, workspaceType, workspaceScopeId }),
    workspaceContractVersion: REVIEW_WORKSPACE_CONTRACT_VERSION,
    workspaceType,
    workspaceScope: workspaceType,
    workspaceScopeId,
    landlordId,
    assignedReviewer: input.assignedReviewer ? normalizeReviewWorkspaceReviewer(input.assignedReviewer) : null,
    reviewStatus: VALID_STATUSES.has(reviewStatus) ? reviewStatus : "open",
    reviewPriority: VALID_PRIORITIES.has(reviewPriority) ? reviewPriority : "needs_review",
    evidenceRefs,
    relatedResourceRefs,
    createdFromEvent: normalizeReviewWorkspaceEventRef(input.createdFromEvent),
    createdBy: normalizeReviewWorkspaceReviewer(input.createdBy),
    createdAt,
    updatedAt: createdAt,
    reviewSummary: safeText(input.reviewSummary, 500) || `${workspaceTypeLabel(workspaceType)} workspace`,
    reviewNotes,
    reviewTags,
    auditRefs: normalizeReviewWorkspaceAuditRefs(input.auditRefs),
    sensitivityClass: VALID_SENSITIVITY.has(sensitivityClass) ? sensitivityClass : "sensitive",
    visibilityClass: VALID_VISIBILITY.has(visibilityClass) ? visibilityClass : "landlord_operational",
    manualOnly: true,
    autonomousActionsEnabled: false,
    externalSharingEnabled: false,
    institutionalSharingEnabled: false,
    financialMutationEnabled: false,
  };
}

function operatorScopeForWorkspace(workspaceType: ReviewWorkspaceType): OperatorReviewScope {
  if (workspaceType === "delinquency_review") return "delinquency";
  if (workspaceType === "evidence_review" || workspaceType === "document_review") return "audit_compliance";
  return "workflow";
}

export function reviewWorkspaceToOperatorReviewOpenRequest(workspace: ReviewWorkspace): OperatorReviewOpenRequest {
  return {
    scope: operatorScopeForWorkspace(workspace.workspaceType),
    scopeId: workspace.workspaceScopeId,
    linkedEvidence: workspace.evidenceRefs.map((ref) => ({
      evidenceId: ref.evidencePackId,
      label: ref.label,
      kind: "workflow",
      destination: null,
    })),
    note: workspace.reviewSummary,
  };
}

export function normalizeReviewWorkspace(raw: unknown): ReviewWorkspace | null {
  const data = (raw || {}) as Record<string, unknown>;
  try {
    const workspace = buildReviewWorkspace({
      workspaceType: data.workspaceType as ReviewWorkspaceType,
      workspaceScopeId: data.workspaceScopeId,
      landlordId: data.landlordId,
      createdBy: data.createdBy as ReviewWorkspaceReviewer,
      createdAt: data.createdAt,
      assignedReviewer: data.assignedReviewer as ReviewWorkspaceReviewer | null,
      reviewStatus: data.reviewStatus as ReviewWorkspaceStatus,
      reviewPriority: data.reviewPriority as ReviewWorkspacePriority,
      evidenceRefs: data.evidenceRefs as Array<Record<string, unknown>>,
      relatedResourceRefs: data.relatedResourceRefs as Array<Record<string, unknown>>,
      createdFromEvent: data.createdFromEvent as Record<string, unknown>,
      reviewSummary: data.reviewSummary as string,
      reviewNotes: data.reviewNotes as unknown[],
      reviewTags: data.reviewTags as unknown[],
      auditRefs: data.auditRefs as Array<Record<string, unknown>>,
      sensitivityClass: data.sensitivityClass as ReviewWorkspaceSensitivityClass,
      visibilityClass: data.visibilityClass as ReviewWorkspaceVisibilityClass,
      tenantId: data.tenantId as string | null,
    });
    return {
      ...workspace,
      workspaceId: asString(data.workspaceId, 240) || workspace.workspaceId,
      updatedAt: toIsoDate(data.updatedAt) || workspace.updatedAt,
    };
  } catch {
    return null;
  }
}
