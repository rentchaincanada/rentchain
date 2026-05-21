import crypto from "crypto";
import type {
  BuildOperationalReadModelInput,
  BuildOperationalReadModelSummaryInput,
  OperationalReadModel,
  OperationalReadModelCounts,
  OperationalReadModelEvidenceLinkageSummary,
  OperationalReadModelPriority,
  OperationalReadModelResourceRef,
  OperationalReadModelRoutingInput,
  OperationalReadModelRoutingSummary,
  OperationalReadModelSourceRef,
  OperationalReadModelStatus,
  OperationalReadModelSummary,
  OperationalReadModelSummaryType,
  OperationalReadModelWorkspaceInput,
} from "./operationalReadModelTypes";
import { OPERATIONAL_READ_MODEL_VERSION } from "./operationalReadModelTypes";
import type {
  ReviewWorkspacePriority,
  ReviewWorkspaceSensitivityClass,
  ReviewWorkspaceVisibilityClass,
} from "../reviewWorkspaces/reviewWorkspaceTypes";

const VALID_SUMMARY_TYPES = new Set<OperationalReadModelSummaryType>([
  "operational_signal",
  "review_queue",
  "review_workspace",
  "work_order",
  "evidence_linkage",
  "consent_routing",
]);

const VALID_PRIORITIES = new Set<OperationalReadModelPriority>(["critical", "warning", "needs_review", "upcoming", "info"]);
const VALID_STATUSES = new Set<OperationalReadModelStatus>([
  "open",
  "needs_review",
  "in_review",
  "blocked",
  "resolved",
  "closed",
  "informational",
]);
const VALID_SENSITIVITY = new Set<ReviewWorkspaceSensitivityClass>(["sensitive", "restricted"]);
const VALID_VISIBILITY = new Set<ReviewWorkspaceVisibilityClass>(["landlord_operational", "admin_support"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanIdPart(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeText(value: unknown, max = 500): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function summaryId(input: { landlordId: string; summaryType: OperationalReadModelSummaryType; itemId: string }): string {
  const clean = cleanIdPart(["operational_read_model", input.landlordId, input.summaryType, input.itemId].join(":"));
  return clean || `operational_read_model:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function normalizePriority(value: unknown): OperationalReadModelPriority {
  const normalized = cleanIdPart(value).replace(/-/g, "_");
  if (normalized === "critical" || normalized === "high") return "critical";
  if (normalized === "warning" || normalized === "medium") return "warning";
  if (normalized === "upcoming") return "upcoming";
  if (normalized === "informational" || normalized === "info" || normalized === "low") return "info";
  return VALID_PRIORITIES.has(normalized as OperationalReadModelPriority)
    ? (normalized as OperationalReadModelPriority)
    : "needs_review";
}

function normalizeStatus(value: unknown): OperationalReadModelStatus {
  const normalized = cleanIdPart(value).replace(/-/g, "_");
  if (normalized === "under_review" || normalized === "in_progress") return "in_review";
  if (normalized === "needs_review" || normalized === "review_needed" || normalized === "pending") return "needs_review";
  if (normalized === "completed" || normalized === "resolved") return "resolved";
  if (normalized === "dismissed" || normalized === "cancelled" || normalized === "canceled") return "closed";
  if (normalized === "informational" || normalized === "info") return "informational";
  return VALID_STATUSES.has(normalized as OperationalReadModelStatus) ? (normalized as OperationalReadModelStatus) : "open";
}

export function normalizeOperationalReadModelSourceRefs(
  raw: unknown,
  scope: { landlordId: string; tenantId?: string | null }
): OperationalReadModelSourceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const sourceCollection = safeText(data.sourceCollection, 120);
      const sourceId = asString(data.sourceId || data.resourceId || data.id, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!sourceCollection || !sourceId) return null;
      if (landlordId && landlordId !== scope.landlordId) return null;
      if (scope.tenantId && tenantId && tenantId !== scope.tenantId) return null;
      return {
        sourceCollection,
        sourceId,
        resourceType: safeText(data.resourceType || data.type, 80) || null,
        landlordId,
        tenantId,
        internalReference: true as const,
      };
    })
    .filter(Boolean) as OperationalReadModelSourceRef[];
  const byKey = new Map<string, OperationalReadModelSourceRef>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
}

export function normalizeOperationalReadModelResourceRefs(
  raw: unknown,
  scope: { landlordId: string; tenantId?: string | null }
): OperationalReadModelResourceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const resourceType = safeText(data.resourceType || data.type, 80);
      const resourceId = asString(data.resourceId || data.id, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!resourceType || !resourceId) return null;
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
        internalReference: true as const,
      };
    })
    .filter(Boolean) as OperationalReadModelResourceRef[];
  const byKey = new Map<string, OperationalReadModelResourceRef>();
  for (const ref of refs) byKey.set(`${ref.resourceType}:${ref.resourceId}`, ref);
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.resourceType}:${a.resourceId}`.localeCompare(`${b.resourceType}:${b.resourceId}`)
  );
}

function normalizeEvidenceLinkageSummary(raw: unknown): OperationalReadModelEvidenceLinkageSummary {
  const data = (raw || {}) as Partial<OperationalReadModelEvidenceLinkageSummary>;
  const sensitivityClasses = uniqueSorted(
    (Array.isArray(data.sensitivityClasses) ? data.sensitivityClasses : [])
      .map((value) => asString(value, 40) as ReviewWorkspaceSensitivityClass)
      .filter((value) => VALID_SENSITIVITY.has(value))
  ) as ReviewWorkspaceSensitivityClass[];
  return {
    evidenceRefCount: Math.max(0, Number(data.evidenceRefCount || 0) || 0),
    sourceRefCount: Math.max(0, Number(data.sourceRefCount || 0) || 0),
    sensitivityClasses,
    projectionProfiles: uniqueSorted(
      (Array.isArray(data.projectionProfiles) ? data.projectionProfiles : []).map((value) => safeText(value, 120))
    ),
    referenceOnly: true,
  };
}

function normalizeRoutingSummary(raw: unknown, fallbackPriority: OperationalReadModelPriority): OperationalReadModelRoutingSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<OperationalReadModelRoutingSummary>;
  return {
    reviewEligible: Boolean(data.reviewEligible),
    reviewReasonLabel: safeText(data.reviewReasonLabel, 180) || null,
    reviewPriority: normalizePriority(data.reviewPriority || fallbackPriority),
    workspaceType: data.workspaceType || null,
    manualOnly: true,
    autoCreateWorkspace: false,
    autonomousActionsEnabled: false,
  };
}

export function buildOperationalReadModelSummary(input: BuildOperationalReadModelSummaryInput): OperationalReadModelSummary {
  const landlordId = asString(input.landlordId, 240);
  const itemId = asString(input.itemId, 240);
  if (!landlordId || !itemId) throw new Error("operational_read_model_scope_required");
  const summaryType = VALID_SUMMARY_TYPES.has(input.summaryType) ? input.summaryType : "operational_signal";
  const generatedAt = toIsoDate(input.generatedAt) || new Date(0).toISOString();
  const priority = normalizePriority(input.priority);
  const tenantId = asString(input.tenantId, 240) || null;
  const sourceRefs = normalizeOperationalReadModelSourceRefs(input.sourceRefs, { landlordId, tenantId });
  const relatedResourceRefs = normalizeOperationalReadModelResourceRefs(input.relatedResourceRefs, { landlordId, tenantId });

  return {
    summaryId: summaryId({ landlordId, summaryType, itemId }),
    summaryType,
    title: safeText(input.title, 180) || "Operational summary",
    operationalSummary: safeText(input.operationalSummary, 500) || "Projection summary derived from scoped operational source records.",
    status: normalizeStatus(input.status),
    priority,
    landlordId,
    tenantId,
    generatedAt,
    sourceRefs,
    relatedResourceRefs,
    routingSummary: normalizeRoutingSummary(input.routingSummary, priority),
    evidenceLinkageSummary: normalizeEvidenceLinkageSummary(input.evidenceLinkageSummary),
    sensitivityClass: VALID_SENSITIVITY.has(input.sensitivityClass as ReviewWorkspaceSensitivityClass)
      ? (input.sensitivityClass as ReviewWorkspaceSensitivityClass)
      : "sensitive",
    visibilityClass: VALID_VISIBILITY.has(input.visibilityClass as ReviewWorkspaceVisibilityClass)
      ? (input.visibilityClass as ReviewWorkspaceVisibilityClass)
      : "landlord_operational",
    canonicalSourceOfTruth: false,
    projectionOnly: true,
    autonomousActionsEnabled: false,
  };
}

export function buildReviewQueueSummary(input: OperationalReadModelRoutingInput): OperationalReadModelSummary {
  const routing = input.routing;
  return buildOperationalReadModelSummary({
    summaryType: "review_queue",
    itemId: routing.itemId,
    landlordId: routing.landlordId,
    tenantId: input.tenantId,
    generatedAt: input.generatedAt,
    title: input.title || routing.reviewReasonLabel,
    operationalSummary: input.operationalSummary || routing.priorityLabel,
    status: input.status || (routing.reviewEligible ? "needs_review" : "informational"),
    priority: routing.reviewPriority,
    sourceRefs: [
      {
        sourceCollection: "operationalReviewRouting",
        sourceId: routing.routingId,
        resourceType: "review_routing",
        landlordId: routing.landlordId,
        tenantId: input.tenantId || null,
      },
    ],
    relatedResourceRefs: routing.relatedResourceRefs,
    routingSummary: {
      reviewEligible: routing.reviewEligible,
      reviewReasonLabel: routing.reviewReasonLabel,
      reviewPriority: routing.reviewPriority,
      workspaceType: routing.workspaceType,
      manualOnly: true,
      autoCreateWorkspace: false,
      autonomousActionsEnabled: false,
    },
  });
}

export function buildReviewWorkspaceSummary(input: OperationalReadModelWorkspaceInput): OperationalReadModelSummary {
  const workspace = input.workspace;
  const evidenceSensitivity = uniqueSorted(workspace.evidenceRefs.map((ref) => ref.sensitivityClass)) as ReviewWorkspaceSensitivityClass[];
  return buildOperationalReadModelSummary({
    summaryType: "review_workspace",
    itemId: workspace.workspaceId,
    landlordId: workspace.landlordId,
    generatedAt: input.generatedAt || workspace.updatedAt,
    title: workspace.reviewSummary,
    operationalSummary: `${workspace.workspaceType.replace(/_/g, " ")} is ${workspace.reviewStatus.replace(/_/g, " ")}.`,
    status: workspace.reviewStatus === "under_review" ? "in_review" : workspace.reviewStatus === "completed" ? "resolved" : workspace.reviewStatus,
    priority: workspace.reviewPriority,
    sourceRefs: [
      {
        sourceCollection: "operatorReviewSessions",
        sourceId: workspace.workspaceId,
        resourceType: "review_workspace",
        landlordId: workspace.landlordId,
      },
      ...workspace.evidenceRefs
        .filter((ref) => ref.sourceCollection && ref.sourceId)
        .map((ref) => ({
          sourceCollection: ref.sourceCollection as string,
          sourceId: ref.sourceId as string,
          resourceType: ref.evidenceType,
          landlordId: workspace.landlordId,
          tenantId: ref.tenantId,
        })),
    ],
    relatedResourceRefs: workspace.relatedResourceRefs,
    evidenceLinkageSummary: {
      evidenceRefCount: workspace.evidenceRefs.length,
      sourceRefCount: workspace.evidenceRefs.filter((ref) => ref.sourceCollection && ref.sourceId).length,
      sensitivityClasses: evidenceSensitivity,
      projectionProfiles: uniqueSorted(workspace.evidenceRefs.map((ref) => ref.projectionProfile || "").filter(Boolean)),
      referenceOnly: true,
    },
    routingSummary: {
      reviewEligible: true,
      reviewReasonLabel: workspace.reviewSummary,
      reviewPriority: workspace.reviewPriority,
      workspaceType: workspace.workspaceType,
      manualOnly: true,
      autoCreateWorkspace: false,
      autonomousActionsEnabled: false,
    },
    sensitivityClass: workspace.sensitivityClass,
    visibilityClass: workspace.visibilityClass,
  });
}

function isSummary(value: unknown): value is OperationalReadModelSummary {
  const data = value as OperationalReadModelSummary;
  return Boolean(data?.summaryId && data?.readModelVersion === undefined && data?.projectionOnly === true);
}

export function buildOperationalCounts(summaries: OperationalReadModelSummary[]): OperationalReadModelCounts {
  return {
    total: summaries.length,
    critical: summaries.filter((item) => item.priority === "critical").length,
    warnings: summaries.filter((item) => item.priority === "warning").length,
    needsReview: summaries.filter((item) => item.priority === "needs_review" || item.status === "needs_review").length,
    upcoming: summaries.filter((item) => item.priority === "upcoming").length,
    informational: summaries.filter((item) => item.priority === "info" || item.status === "informational").length,
    reviewEligible: summaries.filter((item) => item.routingSummary?.reviewEligible).length,
    workOrders: summaries.filter((item) => item.summaryType === "work_order").length,
    reviewWorkspaces: summaries.filter((item) => item.summaryType === "review_workspace").length,
    evidenceLinked: summaries.filter((item) => item.evidenceLinkageSummary.evidenceRefCount > 0).length,
  };
}

export function buildOperationalReadModel(input: BuildOperationalReadModelInput): OperationalReadModel {
  const landlordId = asString(input.landlordId, 240);
  if (!landlordId) throw new Error("operational_read_model_landlord_required");
  const generatedAt = toIsoDate(input.generatedAt) || new Date(0).toISOString();
  const tenantlessScope = { landlordId };
  const summaries = (input.summaries || [])
    .filter(Boolean)
    .map((item) => (isSummary(item) ? item : buildOperationalReadModelSummary(item as BuildOperationalReadModelSummaryInput)))
    .filter((item) => item.landlordId === landlordId)
    .sort((a, b) => a.summaryId.localeCompare(b.summaryId));
  const sourceRefs = normalizeOperationalReadModelSourceRefs(
    summaries.flatMap((summary) => summary.sourceRefs),
    tenantlessScope
  );
  const sourceCollections = uniqueSorted(sourceRefs.map((ref) => ref.sourceCollection));

  return {
    readModelVersion: OPERATIONAL_READ_MODEL_VERSION,
    readModelType: "operational_coordination",
    landlordId,
    generatedAt,
    staleAt: toIsoDate(input.staleAt),
    sourceCollections,
    sourceRefs,
    operationalCounts: buildOperationalCounts(summaries),
    summaries,
    consistencyExpectation: "projection_rebuildable_from_source",
    canonicalSourceOfTruth: false,
    projectionOnly: true,
    autonomousActionsEnabled: false,
    permissionWideningRequired: false,
  };
}
