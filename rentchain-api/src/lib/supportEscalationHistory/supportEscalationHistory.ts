import {
  approvalRequirementForEscalation,
  normalizeSupportEscalationCategory,
  normalizeSupportEscalationRefs,
  normalizeSupportEscalationSeverity,
  normalizeSupportEscalationState,
  type SupportEscalationApprovalRequirement,
  type SupportEscalationCategory,
  type SupportEscalationSafeRef,
  type SupportEscalationSeverity,
  type SupportEscalationState,
} from "../supportEscalationRunbooks/supportEscalationRunbooks";

export const SUPPORT_ESCALATION_HISTORY_VERSION = "support_escalation_history_v1";

export type SupportEscalationActionType =
  | "escalation_created"
  | "triage_started"
  | "review_note_added"
  | "approval_requested"
  | "manual_action_approved"
  | "manual_action_declined"
  | "escalation_resolved"
  | "escalation_dismissed"
  | "evidence_ref_added"
  | "runbook_template_applied";

export type SupportEscalationNoteType =
  | "triage_note"
  | "security_review_note"
  | "support_lead_note"
  | "admin_review_note"
  | "evidence_note"
  | "resolution_note"
  | "dismissal_note";

export type SupportEscalationActorSummary = {
  role: string | null;
  displayName: string | null;
  supportAttribution: boolean;
  rawActorIdsIncluded: false;
};

export type SupportEscalationHistoryEntry = {
  supportEscalationHistoryVersion: typeof SUPPORT_ESCALATION_HISTORY_VERSION;
  historyEntryId: string;
  escalationRefId: string;
  category: SupportEscalationCategory;
  severity: SupportEscalationSeverity;
  state: SupportEscalationState;
  actionType: SupportEscalationActionType;
  actorSummary: SupportEscalationActorSummary;
  occurredAt: string;
  noteSummary: string;
  approvalExpectation: SupportEscalationApprovalRequirement;
  safeEvidenceRefs: SupportEscalationSafeRef[];
  resourceRefs: SupportEscalationSafeRef[];
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendOnly: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  payloadSafety: SupportEscalationPayloadSafety;
};

export type SupportEscalationReviewNote = {
  supportEscalationHistoryVersion: typeof SUPPORT_ESCALATION_HISTORY_VERSION;
  noteId: string;
  escalationRefId: string;
  noteType: SupportEscalationNoteType;
  noteSummary: string;
  authorSummary: SupportEscalationActorSummary;
  createdAt: string;
  safeEvidenceRefs: SupportEscalationSafeRef[];
  resourceRefs: SupportEscalationSafeRef[];
  redactionSummary: string;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendOnly: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  payloadSafety: SupportEscalationPayloadSafety;
};

type SupportEscalationPayloadSafety = {
  rawPayloads: "excluded";
  providerData: "reference_only";
  evidenceData: "reference_only";
  exportData: "reference_only";
  documentData: "reference_only";
  credentialData: "excluded";
  requestResponseData: "excluded";
  diagnosticData: "metadata_only";
  internalPolicyData: "summary_only";
};

const ACTION_TYPES = new Set<SupportEscalationActionType>([
  "escalation_created",
  "triage_started",
  "review_note_added",
  "approval_requested",
  "manual_action_approved",
  "manual_action_declined",
  "escalation_resolved",
  "escalation_dismissed",
  "evidence_ref_added",
  "runbook_template_applied",
]);

const NOTE_TYPES = new Set<SupportEscalationNoteType>([
  "triage_note",
  "security_review_note",
  "support_lead_note",
  "admin_review_note",
  "evidence_note",
  "resolution_note",
  "dismissal_note",
]);

const PAYLOAD_SAFETY: SupportEscalationPayloadSafety = {
  rawPayloads: "excluded",
  providerData: "reference_only",
  evidenceData: "reference_only",
  exportData: "reference_only",
  documentData: "reference_only",
  credentialData: "excluded",
  requestResponseData: "excluded",
  diagnosticData: "metadata_only",
  internalPolicyData: "summary_only",
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 140).toLowerCase().replace(/[\s.-]+/g, "_");
}

function idPart(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") return (value as any).toDate().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function safeText(value: unknown, max = 500): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function redactNoteSummary(value: unknown): string {
  let next = safeText(value, 700);
  if (!next) return "Manual support escalation note recorded as metadata-only summary.";
  next = next.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "[redacted authorization]");
  next = next.replace(/(token|secret|credential|password|authorization|cookie)\s*[:=]\s*[^,\s;]+/gi, "$1=[redacted]");
  next = next.replace(/gs:\/\/[^\s]+/gi, "[redacted storage reference]");
  next = next.replace(/https:\/\/storage\.googleapis\.com\/[^\s]+/gi, "[redacted storage reference]");
  next = next.replace(/stack(trace)?\s*[:=].*$/gi, "stack=[redacted diagnostic]");
  return next.slice(0, 500).trim() || "Manual support escalation note recorded as metadata-only summary.";
}

function actorSummary(input: unknown): SupportEscalationActorSummary {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    role: safeText(data.role || data.actorRole, 80) || null,
    displayName: safeText(data.displayName || data.label || data.name, 120) || null,
    supportAttribution: Boolean(data.supportAttribution || data.supportProjectionSafe || data.role === "admin" || data.role === "support"),
    rawActorIdsIncluded: false,
  };
}

export function normalizeSupportEscalationActionType(value: unknown): SupportEscalationActionType {
  const normalized = normalizeKey(value);
  return ACTION_TYPES.has(normalized as SupportEscalationActionType)
    ? (normalized as SupportEscalationActionType)
    : "review_note_added";
}

export function normalizeSupportEscalationNoteType(value: unknown): SupportEscalationNoteType {
  const normalized = normalizeKey(value);
  return NOTE_TYPES.has(normalized as SupportEscalationNoteType)
    ? (normalized as SupportEscalationNoteType)
    : "triage_note";
}

function escalationRefId(value: unknown): string {
  return idPart(value) || "support_escalation_unknown";
}

function safeFlags() {
  return {
    metadataOnly: true as const,
    visibilityClass: "admin_support_internal" as const,
    tenantVisible: false as const,
    landlordVisible: false as const,
    appendOnly: true as const,
    supportPowersGranted: false as const,
    impersonationEnabled: false as const,
    autonomousRemediationEnabled: false as const,
    autonomousEscalationEnabled: false as const,
    financialMutationEnabled: false as const,
    routeVisibilityChanged: false as const,
    payloadSafety: PAYLOAD_SAFETY,
  };
}

export function buildSupportEscalationHistoryEntry(input: {
  historyEntryId?: string | null;
  escalationRefId?: string | null;
  category?: unknown;
  severity?: unknown;
  state?: unknown;
  actionType?: unknown;
  actor?: Record<string, unknown> | null;
  occurredAt?: unknown;
  noteSummary?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  safeEvidenceRefs?: Array<Record<string, unknown>> | null;
  resourceRefs?: Array<Record<string, unknown>> | null;
}): SupportEscalationHistoryEntry {
  const category = normalizeSupportEscalationCategory(input.category);
  const severity = normalizeSupportEscalationSeverity(input.severity);
  const state = normalizeSupportEscalationState(input.state);
  const actionType = normalizeSupportEscalationActionType(input.actionType);
  const occurredAt = toIso(input.occurredAt);
  const escalationId = escalationRefId(input.escalationRefId);
  const scope = { landlordId: asString(input.landlordId, 240) || null, tenantId: asString(input.tenantId, 240) || null };
  return {
    supportEscalationHistoryVersion: SUPPORT_ESCALATION_HISTORY_VERSION,
    historyEntryId:
      idPart(input.historyEntryId) ||
      idPart(["support_escalation_history", escalationId, actionType, occurredAt].join(":")),
    escalationRefId: escalationId,
    category,
    severity,
    state,
    actionType,
    actorSummary: actorSummary(input.actor),
    occurredAt,
    noteSummary: redactNoteSummary(input.noteSummary),
    approvalExpectation: approvalRequirementForEscalation({ category, severity }),
    safeEvidenceRefs: normalizeSupportEscalationRefs(input.safeEvidenceRefs, scope),
    resourceRefs: normalizeSupportEscalationRefs(input.resourceRefs, scope),
    ...safeFlags(),
  };
}

export function buildSupportEscalationReviewNote(input: {
  noteId?: string | null;
  escalationRefId?: string | null;
  noteType?: unknown;
  noteSummary?: string | null;
  author?: Record<string, unknown> | null;
  createdAt?: unknown;
  landlordId?: string | null;
  tenantId?: string | null;
  safeEvidenceRefs?: Array<Record<string, unknown>> | null;
  resourceRefs?: Array<Record<string, unknown>> | null;
}): SupportEscalationReviewNote {
  const noteType = normalizeSupportEscalationNoteType(input.noteType);
  const createdAt = toIso(input.createdAt);
  const escalationId = escalationRefId(input.escalationRefId);
  const noteSummary = redactNoteSummary(input.noteSummary);
  const scope = { landlordId: asString(input.landlordId, 240) || null, tenantId: asString(input.tenantId, 240) || null };
  return {
    supportEscalationHistoryVersion: SUPPORT_ESCALATION_HISTORY_VERSION,
    noteId: idPart(input.noteId) || idPart(["support_escalation_note", escalationId, noteType, createdAt].join(":")),
    escalationRefId: escalationId,
    noteType,
    noteSummary,
    authorSummary: actorSummary(input.author),
    createdAt,
    safeEvidenceRefs: normalizeSupportEscalationRefs(input.safeEvidenceRefs, scope),
    resourceRefs: normalizeSupportEscalationRefs(input.resourceRefs, scope),
    redactionSummary:
      "Manual note is stored as metadata-only summary; raw payloads, credentials, documents, storage paths, request/response bodies, stack traces, and debug payloads are excluded.",
    ...safeFlags(),
  };
}
