import crypto from "crypto";
import {
  buildGovernedReviewWorkspaceSummary,
  normalizeGovernedReviewWorkspaceType,
  type GovernedReviewWorkspaceSummary,
  type GovernedReviewWorkspaceType,
} from "../governedReviewWorkspaces/governedReviewWorkspaces";
import type { EscalationReviewWorkspaceLink } from "../escalationReviewWorkspaceLinks/escalationReviewWorkspaceLinks";
import type { SupportEscalationSafeRef } from "../supportEscalationRunbooks/supportEscalationRunbooks";

export const GOVERNED_REVIEW_WORKSPACE_PERSISTENCE_VERSION =
  "governed_review_workspace_persistence_readiness_v1";

export type GovernedReviewWorkspaceRetentionClass =
  | "standard_review"
  | "security_review"
  | "export_governance"
  | "legal_hold_candidate"
  | "short_lived_diagnostic"
  | "other";

export type GovernedReviewWorkspaceAppendEventType =
  | "workspace_candidate_created"
  | "workspace_link_added"
  | "workspace_evidence_ref_added"
  | "workspace_note_ref_added"
  | "workspace_export_readiness_assessed"
  | "workspace_retention_reviewed";

export type GovernedReviewWorkspacePersistenceVisibility = {
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendCompatible: true;
  appendOnly: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  mutationControlsEnabled: false;
  rawPayloadAccessEnabled: false;
  firestoreWriteEnabled: false;
  createRouteEnabled: false;
  updateRouteEnabled: false;
  deleteRouteEnabled: false;
  statusMutationEnabled: false;
  tenantLandlordProjectionEnabled: false;
};

export type GovernedReviewWorkspacePayloadSafety = {
  rawPayloads: "excluded";
  rawNotes: "summary_only";
  providerData: "reference_only";
  screeningReports: "reference_only";
  storagePaths: "excluded";
  credentialData: "excluded";
  requestResponseData: "excluded";
  diagnosticData: "metadata_only";
  internalPolicyData: "summary_only";
  rawIdsAsLabels: "excluded";
};

export type GovernedReviewWorkspaceAppendEventRef = GovernedReviewWorkspacePersistenceVisibility & {
  governedReviewWorkspacePersistenceVersion: typeof GOVERNED_REVIEW_WORKSPACE_PERSISTENCE_VERSION;
  eventRefId: string;
  eventType: GovernedReviewWorkspaceAppendEventType;
  workspaceId: string;
  eventSummary: string;
  actorSummary: {
    role: string | null;
    displayName: string | null;
    rawActorIdsIncluded: false;
  };
  occurredAt: string;
  relatedEvidenceRefs: SupportEscalationSafeRef[];
  relatedWorkspaceLinks: EscalationReviewWorkspaceLink[];
  payloadSafety: GovernedReviewWorkspacePayloadSafety;
  redactionSummary: string;
};

export type GovernedReviewWorkspacePersistenceRecord = GovernedReviewWorkspacePersistenceVisibility & {
  governedReviewWorkspacePersistenceVersion: typeof GOVERNED_REVIEW_WORKSPACE_PERSISTENCE_VERSION;
  persistenceContractId: string;
  workspaceId: string;
  workspaceType: GovernedReviewWorkspaceType;
  title: string;
  summary: string;
  workflowFamily: string | null;
  retentionClass: GovernedReviewWorkspaceRetentionClass;
  retentionReason: string;
  retentionReviewAt: string | null;
  createdAt: string;
  lastAppendedAt: string;
  workspaceSummary: GovernedReviewWorkspaceSummary;
  appendEventRefs: GovernedReviewWorkspaceAppendEventRef[];
  safeEvidenceRefs: SupportEscalationSafeRef[];
  relatedWorkspaceLinks: EscalationReviewWorkspaceLink[];
  payloadSafety: GovernedReviewWorkspacePayloadSafety;
  redactionSummary: string;
  persistenceDecision: "contract_only_firestore_deferred";
};

export type GovernedReviewWorkspacePersistenceValidation = {
  ok: true;
  record: GovernedReviewWorkspacePersistenceRecord;
  warnings: string[];
};

const RETENTION_CLASSES = new Set<GovernedReviewWorkspaceRetentionClass>([
  "standard_review",
  "security_review",
  "export_governance",
  "legal_hold_candidate",
  "short_lived_diagnostic",
  "other",
]);

const APPEND_EVENT_TYPES = new Set<GovernedReviewWorkspaceAppendEventType>([
  "workspace_candidate_created",
  "workspace_link_added",
  "workspace_evidence_ref_added",
  "workspace_note_ref_added",
  "workspace_export_readiness_assessed",
  "workspace_retention_reviewed",
]);

const PAYLOAD_SAFETY: GovernedReviewWorkspacePayloadSafety = {
  rawPayloads: "excluded",
  rawNotes: "summary_only",
  providerData: "reference_only",
  screeningReports: "reference_only",
  storagePaths: "excluded",
  credentialData: "excluded",
  requestResponseData: "excluded",
  diagnosticData: "metadata_only",
  internalPolicyData: "summary_only",
  rawIdsAsLabels: "excluded",
};

type AppendEventInput = {
  eventType?: unknown;
  eventSummary?: unknown;
  actor?: Record<string, unknown> | null;
  occurredAt?: unknown;
  relatedEvidenceRefs?: Array<Partial<SupportEscalationSafeRef> | Record<string, unknown>> | null;
  relatedWorkspaceLinks?: EscalationReviewWorkspaceLink[] | null;
};

type PersistenceInput = {
  workspaceSummary?: Partial<GovernedReviewWorkspaceSummary> | null;
  workspaceType?: unknown;
  title?: unknown;
  summary?: unknown;
  workflowFamily?: unknown;
  severity?: unknown;
  reviewState?: unknown;
  approvalExpectation?: unknown;
  retentionClass?: unknown;
  retentionReason?: unknown;
  retentionReviewAt?: unknown;
  createdAt?: unknown;
  lastAppendedAt?: unknown;
  safeEvidenceRefs?: Array<Partial<SupportEscalationSafeRef> | Record<string, unknown>> | null;
  relatedWorkspaceLinks?: EscalationReviewWorkspaceLink[] | null;
  appendEvents?: AppendEventInput[] | null;
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 140).toLowerCase().replace(/[\s.-]+/g, "_");
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") return (value as any).toDate().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function safeLabel(value: unknown, fallback: string, max = 220): string {
  const label = asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  if (/gs:\/\//i.test(label) || /storage\.googleapis\.com/i.test(label)) return fallback;
  if (/token|secret|credential|authorization|cookie|password|bearer/i.test(label)) return fallback;
  if (/request\s*body|response\s*body|stack(trace)?|debug payload/i.test(label)) return fallback;
  if (/^[a-zA-Z0-9_-]{16,}$/.test(label)) return fallback;
  return label;
}

function visibilityFlags(): GovernedReviewWorkspacePersistenceVisibility {
  return {
    metadataOnly: true,
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    landlordVisible: false,
    appendCompatible: true,
    appendOnly: true,
    supportPowersGranted: false,
    impersonationEnabled: false,
    autonomousRemediationEnabled: false,
    autonomousEscalationEnabled: false,
    financialMutationEnabled: false,
    routeVisibilityChanged: false,
    mutationControlsEnabled: false,
    rawPayloadAccessEnabled: false,
    firestoreWriteEnabled: false,
    createRouteEnabled: false,
    updateRouteEnabled: false,
    deleteRouteEnabled: false,
    statusMutationEnabled: false,
    tenantLandlordProjectionEnabled: false,
  };
}

export function normalizeGovernedReviewWorkspaceRetentionClass(
  value: unknown
): GovernedReviewWorkspaceRetentionClass {
  const normalized = normalizeKey(value);
  return RETENTION_CLASSES.has(normalized as GovernedReviewWorkspaceRetentionClass)
    ? (normalized as GovernedReviewWorkspaceRetentionClass)
    : "other";
}

export function normalizeGovernedReviewWorkspaceAppendEventType(
  value: unknown
): GovernedReviewWorkspaceAppendEventType {
  const normalized = normalizeKey(value);
  return APPEND_EVENT_TYPES.has(normalized as GovernedReviewWorkspaceAppendEventType)
    ? (normalized as GovernedReviewWorkspaceAppendEventType)
    : "workspace_candidate_created";
}

function actorSummary(actor: AppendEventInput["actor"]): GovernedReviewWorkspaceAppendEventRef["actorSummary"] {
  const data = (actor && typeof actor === "object" ? actor : {}) as Record<string, unknown>;
  return {
    role: safeLabel(data.role || data.actorRole, "", 80) || null,
    displayName: safeLabel(data.displayName || data.label || data.name, "", 120) || null,
    rawActorIdsIncluded: false,
  };
}

function buildWorkspaceSummary(input: PersistenceInput): GovernedReviewWorkspaceSummary {
  if (input.workspaceSummary?.metadataOnly === true) {
    return buildGovernedReviewWorkspaceSummary({
      workspaceType: input.workspaceSummary.workspaceType,
      title: input.workspaceSummary.title,
      summary: input.workspaceSummary.summary,
      workflowFamily: input.workspaceSummary.workflowFamily,
      severity: input.workspaceSummary.severitySummary,
      reviewState: input.workspaceSummary.reviewStateSummary,
      approvalExpectation: input.workspaceSummary.approvalExpectationSummary,
      relatedIncidentCount: input.workspaceSummary.relatedIncidentCount,
      relatedEscalationCount: input.workspaceSummary.relatedEscalationCount,
      relatedEvidenceCount: input.workspaceSummary.relatedEvidenceCount,
      relatedNoteCount: input.workspaceSummary.relatedNoteCount,
      safeEvidenceRefs: input.workspaceSummary.safeEvidenceRefs,
      relatedWorkspaceLinks: input.workspaceSummary.relatedWorkspaceLinks,
    });
  }
  return buildGovernedReviewWorkspaceSummary({
    workspaceType: input.workspaceType,
    title: input.title,
    summary: input.summary,
    workflowFamily: input.workflowFamily,
    severity: input.severity,
    reviewState: input.reviewState,
    approvalExpectation: input.approvalExpectation,
    safeEvidenceRefs: input.safeEvidenceRefs,
    relatedWorkspaceLinks: input.relatedWorkspaceLinks,
  });
}

function buildAppendEventRef(input: {
  event: AppendEventInput;
  workspaceId: string;
  fallbackOccurredAt: string;
  workspaceEvidenceRefs: SupportEscalationSafeRef[];
  workspaceLinks: EscalationReviewWorkspaceLink[];
}): GovernedReviewWorkspaceAppendEventRef {
  const eventType = normalizeGovernedReviewWorkspaceAppendEventType(input.event.eventType);
  const occurredAt = toIso(input.event.occurredAt || input.fallbackOccurredAt);
  const relatedEvidenceRefs = buildGovernedReviewWorkspaceSummary({
    safeEvidenceRefs: input.event.relatedEvidenceRefs || input.workspaceEvidenceRefs,
  }).safeEvidenceRefs;
  const relatedWorkspaceLinks = (input.event.relatedWorkspaceLinks || input.workspaceLinks)
    .filter((link) => link?.metadataOnly === true)
    .slice(0, 20);
  const eventSummary = safeLabel(
    input.event.eventSummary,
    `${eventType.split("_").join(" ")} metadata event`,
    240
  );
  return {
    governedReviewWorkspacePersistenceVersion: GOVERNED_REVIEW_WORKSPACE_PERSISTENCE_VERSION,
    eventRefId: `governed_workspace_event:${stableHash([input.workspaceId, eventType, eventSummary, occurredAt])}`,
    eventType,
    workspaceId: input.workspaceId,
    eventSummary,
    actorSummary: actorSummary(input.event.actor),
    occurredAt,
    relatedEvidenceRefs,
    relatedWorkspaceLinks,
    payloadSafety: PAYLOAD_SAFETY,
    redactionSummary:
      "Append event refs are metadata-only; raw notes, documents, provider payloads, reports, storage paths, tokens, secrets, request/response bodies, debug payloads, raw IDs as labels, and policy internals are excluded.",
    ...visibilityFlags(),
  };
}

export function buildGovernedReviewWorkspacePersistenceRecord(
  input: PersistenceInput = {}
): GovernedReviewWorkspacePersistenceRecord {
  const workspaceSummary = buildWorkspaceSummary(input);
  const workspaceType = normalizeGovernedReviewWorkspaceType(workspaceSummary.workspaceType);
  const createdAt = toIso(input.createdAt);
  const lastAppendedAt = toIso(input.lastAppendedAt || input.createdAt);
  const retentionClass = normalizeGovernedReviewWorkspaceRetentionClass(input.retentionClass);
  const appendEventRefs = (input.appendEvents || [
    {
      eventType: "workspace_candidate_created",
      eventSummary: "Governed review workspace persistence candidate created.",
      occurredAt: createdAt,
    },
  ])
    .map((event) =>
      buildAppendEventRef({
        event,
        workspaceId: workspaceSummary.workspaceId,
        fallbackOccurredAt: createdAt,
        workspaceEvidenceRefs: workspaceSummary.safeEvidenceRefs,
        workspaceLinks: workspaceSummary.relatedWorkspaceLinks,
      })
    )
    .sort((a, b) => `${a.occurredAt}:${a.eventRefId}`.localeCompare(`${b.occurredAt}:${b.eventRefId}`))
    .slice(0, 50);

  return {
    governedReviewWorkspacePersistenceVersion: GOVERNED_REVIEW_WORKSPACE_PERSISTENCE_VERSION,
    persistenceContractId: `governed_workspace_persistence:${stableHash([
      workspaceSummary.workspaceId,
      workspaceType,
      createdAt,
    ])}`,
    workspaceId: workspaceSummary.workspaceId,
    workspaceType,
    title: workspaceSummary.title,
    summary: workspaceSummary.summary,
    workflowFamily: workspaceSummary.workflowFamily,
    retentionClass,
    retentionReason: safeLabel(input.retentionReason, "Metadata-only governed review workspace retention candidate.", 240),
    retentionReviewAt: input.retentionReviewAt ? toIso(input.retentionReviewAt) : null,
    createdAt,
    lastAppendedAt,
    workspaceSummary,
    appendEventRefs,
    safeEvidenceRefs: workspaceSummary.safeEvidenceRefs,
    relatedWorkspaceLinks: workspaceSummary.relatedWorkspaceLinks,
    payloadSafety: PAYLOAD_SAFETY,
    redactionSummary:
      "Persistence readiness records are contract-only and metadata-only. Firestore writes, routes, status mutation, tenant/landlord projections, raw payload access, raw notes, documents, provider payloads, screening reports, storage paths, tokens, secrets, request/response bodies, debug payloads, raw IDs as labels, and policy internals are excluded.",
    persistenceDecision: "contract_only_firestore_deferred",
    ...visibilityFlags(),
  };
}

export function validateGovernedReviewWorkspacePersistenceCandidate(
  input: PersistenceInput = {}
): GovernedReviewWorkspacePersistenceValidation {
  const warnings: string[] = [];
  const raw = JSON.stringify(input ?? {});
  if (/token|secret|credential|authorization|cookie|password|bearer/i.test(raw)) {
    warnings.push("restricted_credential_or_secret_like_input_sanitized");
  }
  if (/gs:\/\/|storage\.googleapis\.com/i.test(raw)) {
    warnings.push("storage_path_or_signed_url_input_sanitized");
  }
  if (/requestBody|responseBody|stackTrace|debugPayload|rawProviderPayload|rawScreeningReport/i.test(raw)) {
    warnings.push("raw_payload_input_excluded_from_contract");
  }
  if ((input.workspaceSummary as any)?.tenantVisible === true || (input.workspaceSummary as any)?.landlordVisible === true) {
    warnings.push("tenant_or_landlord_visibility_forced_false");
  }
  return {
    ok: true,
    record: buildGovernedReviewWorkspacePersistenceRecord(input),
    warnings,
  };
}
