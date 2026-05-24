import crypto from "crypto";
import { projectAdminSupportMetadataForAudience } from "../adminSupportProjectionSafety/adminSupportProjectionSafety";
import {
  buildIncidentWorkspaceLinks,
  type EscalationReviewWorkspaceLink,
} from "../escalationReviewWorkspaceLinks/escalationReviewWorkspaceLinks";
import {
  buildIncidentGovernedReviewWorkspaceSummary,
  type GovernedReviewWorkspaceSummary,
} from "../governedReviewWorkspaces/governedReviewWorkspaces";

export const ADMIN_SECURITY_INCIDENT_REVIEW_VERSION = "admin_security_incident_review_v1";

export type AdminSecurityIncidentCategory =
  | "impersonation_started"
  | "impersonation_ended"
  | "impersonation_denied"
  | "policy_denied"
  | "projection_safety_redaction"
  | "export_blocked"
  | "export_prepared"
  | "support_metadata_redacted"
  | "route_source_anomaly"
  | "auth_required_failure"
  | "admin_access_denied"
  | "automation_blocked"
  | "webhook_failure"
  | "screening_provider_callback_anomaly";

export type AdminSecurityIncidentSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AdminSecurityIncidentStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type AdminSecurityIncidentReviewRecord = {
  incidentReviewVersion: typeof ADMIN_SECURITY_INCIDENT_REVIEW_VERSION;
  incidentId: string;
  category: AdminSecurityIncidentCategory;
  severity: AdminSecurityIncidentSeverity;
  status: AdminSecurityIncidentStatus;
  title: string;
  summary: string;
  occurredAt: string;
  lastSeenAt: string;
  actorSummary: {
    role: string | null;
    supportAttribution: boolean;
    rawActorIdsIncluded: false;
  };
  targetSummary: {
    accountType: string | null;
    resourceType: string | null;
    landlordScoped: boolean;
    tenantScoped: boolean;
    rawTargetIdsIncluded: false;
  };
  workflowFamily: string | null;
  policyOutcomeSummary: string | null;
  sourceRoute: string | null;
  routeSource: string | null;
  metadataOnly: true;
  redactionSummary: string;
  recommendedReviewAction: string;
  safeEvidenceReferences: Array<{
    referenceType: "event" | "telemetry" | "audit" | "evidence" | "export";
    referenceId: string;
    label: string;
    internalReference: true;
  }>;
};

export type AdminSecurityIncidentReviewDetail = AdminSecurityIncidentReviewRecord & {
  timeline: Array<{
    occurredAt: string;
    label: string;
    category: AdminSecurityIncidentCategory;
    metadataOnly: true;
  }>;
  relatedEventSummaries: Array<{
    eventType: string;
    sourceCollection: string;
    occurredAt: string;
    summary: string;
    metadataOnly: true;
  }>;
  redactionNotes: string[];
  suggestedNextReviewStep: string;
  relatedWorkspaceLinks: EscalationReviewWorkspaceLink[];
  governedReviewWorkspace: GovernedReviewWorkspaceSummary;
};

const SUPPORTED_CATEGORIES = new Set<AdminSecurityIncidentCategory>([
  "impersonation_started",
  "impersonation_ended",
  "impersonation_denied",
  "policy_denied",
  "projection_safety_redaction",
  "export_blocked",
  "export_prepared",
  "support_metadata_redacted",
  "route_source_anomaly",
  "auth_required_failure",
  "admin_access_denied",
  "automation_blocked",
  "webhook_failure",
  "screening_provider_callback_anomaly",
]);

const RESTRICTED_KEYS = new Set([
  "realActorId",
  "effectiveActorId",
  "impersonationSessionId",
  "targetAccountId",
  "actor",
  "actorUserId",
  "userId",
  "tenantId",
  "landlordId",
  "rawPayload",
  "payload",
  "rawReport",
  "providerPayload",
  "providerResponse",
  "requestBody",
  "responseBody",
  "stack",
  "stackTrace",
  "token",
  "authorization",
  "cookie",
  "secret",
  "password",
  "credential",
  "storagePath",
  "documentPath",
]);

function asString(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeText(value: unknown, max = 500): string | null {
  const next = asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return next || null;
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") {
    return (value as any).toDate().toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

function hasRestrictedMaterial(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRestrictedMaterial);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (RESTRICTED_KEYS.has(key) || /token|secret|password|credential|authorization|cookie|raw|payload|stack/i.test(key)) {
      return true;
    }
    return hasRestrictedMaterial(nested);
  });
}

function safeMeta(input: Record<string, unknown>): Record<string, unknown> {
  const projected = projectAdminSupportMetadataForAudience(input, "admin_support") as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(projected || {})) {
    if (RESTRICTED_KEYS.has(key) || /token|secret|password|credential|authorization|cookie|raw|payload|stack/i.test(key)) continue;
    if (value == null || typeof value !== "object") {
      output[key] = value;
    }
  }
  return output;
}

function eventTypeFor(record: Record<string, unknown>): string {
  return asString(record.type || record.eventType || record.kind || record.action, 160);
}

function classifyCategory(record: Record<string, unknown>): AdminSecurityIncidentCategory | null {
  const eventType = normalizeKey(eventTypeFor(record));
  const meta = (record.meta && typeof record.meta === "object" ? record.meta : {}) as Record<string, unknown>;
  const sourceRoute = normalizeKey(meta.sourceRoute || record.sourceRoute || record.route);
  const routeSource = normalizeKey(meta.routeSource || record.routeSource);

  if (eventType === "impersonation_started") return "impersonation_started";
  if (eventType === "impersonation_ended") return "impersonation_ended";
  if (eventType === "impersonation_denied" || eventType === "impersonation_expired" || eventType === "impersonation_revoked") {
    return "impersonation_denied";
  }
  if (eventType.includes("policy") && (eventType.includes("denied") || eventType.includes("blocked"))) return "policy_denied";
  if (eventType.includes("projection") && (eventType.includes("redaction") || eventType.includes("redacted"))) {
    return "projection_safety_redaction";
  }
  if (eventType.includes("support") && eventType.includes("redacted")) return "support_metadata_redacted";
  if (eventType.includes("export") && eventType.includes("blocked")) return "export_blocked";
  if (eventType.includes("export") && (eventType.includes("prepared") || eventType.includes("ready"))) return "export_prepared";
  if (eventType.includes("route_source") && eventType.includes("anomaly")) return "route_source_anomaly";
  if ((sourceRoute || routeSource) && routeSource.includes("not_found")) return "route_source_anomaly";
  if (eventType.includes("auth") && (eventType.includes("required") || eventType.includes("unauthorized"))) return "auth_required_failure";
  if (eventType.includes("admin") && eventType.includes("denied")) return "admin_access_denied";
  if (eventType.includes("automation") && eventType.includes("blocked")) return "automation_blocked";
  if (eventType.includes("webhook") && (eventType.includes("failure") || eventType.includes("failed"))) return "webhook_failure";
  if (eventType.includes("screening") && eventType.includes("callback") && eventType.includes("anomaly")) {
    return "screening_provider_callback_anomaly";
  }
  return null;
}

function severityFor(category: AdminSecurityIncidentCategory): AdminSecurityIncidentSeverity {
  if (category === "route_source_anomaly" || category === "projection_safety_redaction") return "high";
  if (category === "admin_access_denied" || category === "impersonation_denied") return "medium";
  if (category === "policy_denied" || category === "automation_blocked" || category === "webhook_failure") return "medium";
  if (category === "screening_provider_callback_anomaly" || category === "support_metadata_redacted") return "medium";
  if (category === "export_blocked") return "medium";
  return "low";
}

function statusFor(category: AdminSecurityIncidentCategory): AdminSecurityIncidentStatus {
  if (category === "impersonation_ended" || category === "export_prepared") return "resolved";
  if (category === "projection_safety_redaction" || category === "support_metadata_redacted") return "reviewing";
  return "open";
}

function titleFor(category: AdminSecurityIncidentCategory): string {
  return category
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function reviewActionFor(category: AdminSecurityIncidentCategory): string {
  if (category === "impersonation_started" || category === "impersonation_ended" || category === "impersonation_denied") {
    return "Review support attribution and confirm the actor chain remains scoped.";
  }
  if (category === "route_source_anomaly") return "Confirm route ownership and deployed backend revision alignment.";
  if (category === "projection_safety_redaction" || category === "support_metadata_redacted") {
    return "Review projection boundary and confirm redaction happened before user-safe presentation.";
  }
  if (category === "policy_denied" || category === "admin_access_denied") return "Review policy outcome and confirm deny-by-default behavior.";
  if (category === "export_blocked" || category === "export_prepared") return "Review export governance metadata and consent/projection scope.";
  return "Review metadata-only incident context and determine whether manual follow-up is needed.";
}

function actorSummary(record: Record<string, unknown>) {
  const meta = (record.meta && typeof record.meta === "object" ? record.meta : {}) as Record<string, unknown>;
  const actorChain = (meta.actorChain && typeof meta.actorChain === "object" ? meta.actorChain : {}) as Record<string, unknown>;
  return {
    role: safeText(meta.realActorRole || actorChain.realActorRole || record.actorRole || record.role, 80),
    supportAttribution: Boolean(meta.supportProjectionSafe || meta.sourceActionFamily === "admin_support_impersonation" || actorChain.supportAttribution),
    rawActorIdsIncluded: false as const,
  };
}

function targetSummary(record: Record<string, unknown>) {
  const meta = (record.meta && typeof record.meta === "object" ? record.meta : {}) as Record<string, unknown>;
  return {
    accountType: safeText(meta.targetAccountType || meta.effectiveActorRole || record.targetAccountType, 80),
    resourceType: safeText(meta.resourceType || record.resourceType, 80),
    landlordScoped: Boolean(meta.targetLandlordId || record.landlordId),
    tenantScoped: Boolean(meta.targetAccountType === "tenant" || meta.effectiveActorRole === "tenant"),
    rawTargetIdsIncluded: false as const,
  };
}

export function buildAdminSecurityIncidentReviewRecord(input: {
  sourceCollection: "telemetry_events" | "events";
  documentId: string;
  data: Record<string, unknown>;
}): AdminSecurityIncidentReviewRecord | null {
  const category = classifyCategory(input.data);
  if (!category || !SUPPORTED_CATEGORIES.has(category)) return null;
  const occurredAt = toIso(input.data.occurredAt || input.data.createdAt || input.data.ts || input.data.timestamp);
  const meta = (input.data.meta && typeof input.data.meta === "object" ? input.data.meta : {}) as Record<string, unknown>;
  const safe = safeMeta(meta);
  const incidentId = `security_incident:${stableHash([input.sourceCollection, input.documentId, eventTypeFor(input.data), occurredAt])}`;
  const eventType = eventTypeFor(input.data) || category;
  const redacted = hasRestrictedMaterial(input.data);

  return {
    incidentReviewVersion: ADMIN_SECURITY_INCIDENT_REVIEW_VERSION,
    incidentId,
    category,
    severity: severityFor(category),
    status: statusFor(category),
    title: titleFor(category),
    summary:
      safeText(input.data.summary || input.data.title, 280) ||
      `${titleFor(category)} signal derived from ${input.sourceCollection.replace(/_/g, " ")} metadata.`,
    occurredAt,
    lastSeenAt: toIso(input.data.updatedAt || input.data.createdAt || input.data.ts || input.data.occurredAt || occurredAt),
    actorSummary: actorSummary(input.data),
    targetSummary: targetSummary(input.data),
    workflowFamily: safeText(safe.workflowFamily || safe.sourceActionFamily || input.data.workflow, 120),
    policyOutcomeSummary: safeText(safe.policyOutcomeSummary || safe.policyDecision || input.data.policyOutcome, 120),
    sourceRoute: safeText(safe.sourceRoute || input.data.sourceRoute || input.data.route, 180),
    routeSource: safeText(safe.routeSource || input.data.routeSource, 180),
    metadataOnly: true,
    redactionSummary: redacted
      ? "Restricted fields were detected in the source event and excluded from this review projection."
      : "Incident review projection is metadata-only; raw event payloads and internal identifiers are excluded.",
    recommendedReviewAction: reviewActionFor(category),
    safeEvidenceReferences: [
      {
        referenceType: input.sourceCollection === "events" ? "event" : "telemetry",
        referenceId: `${input.sourceCollection}:${stableHash(input.documentId)}`,
        label: `${eventType} metadata reference`,
        internalReference: true,
      },
    ],
  };
}

export function buildAdminSecurityIncidentReviewDetail(
  record: AdminSecurityIncidentReviewRecord
): AdminSecurityIncidentReviewDetail {
  const relatedWorkspaceLinks = buildIncidentWorkspaceLinks({ incident: record });
  const detailWithoutWorkspace = {
    ...record,
    timeline: [
      {
        occurredAt: record.occurredAt,
        label: record.title,
        category: record.category,
        metadataOnly: true as const,
      },
    ],
    relatedEventSummaries: [
      {
        eventType: record.category,
        sourceCollection: record.safeEvidenceReferences[0]?.referenceType || "event",
        occurredAt: record.occurredAt,
        summary: record.summary,
        metadataOnly: true as const,
      },
    ],
    redactionNotes: [
      record.redactionSummary,
      "Raw actor ids, target ids, tokens, provider payloads, documents, storage paths, stack traces, and policy internals are not included.",
    ],
    suggestedNextReviewStep: record.recommendedReviewAction,
    relatedWorkspaceLinks,
  };
  return {
    ...detailWithoutWorkspace,
    governedReviewWorkspace: buildIncidentGovernedReviewWorkspaceSummary(detailWithoutWorkspace),
  };
}

export function filterAdminSecurityIncidentRecords(
  records: AdminSecurityIncidentReviewRecord[],
  filters: {
    category?: string | null;
    severity?: string | null;
    status?: string | null;
    q?: string | null;
  }
) {
  const category = normalizeKey(filters.category);
  const severity = normalizeKey(filters.severity);
  const status = normalizeKey(filters.status);
  const q = asString(filters.q, 120).toLowerCase();
  return records.filter((record) => {
    if (category && record.category !== category) return false;
    if (severity && record.severity !== severity) return false;
    if (status && record.status !== status) return false;
    if (q) {
      const haystack = [record.title, record.summary, record.category, record.workflowFamily, record.routeSource]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
