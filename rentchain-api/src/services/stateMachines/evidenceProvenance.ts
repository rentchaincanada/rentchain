import crypto from "crypto";
import type {
  ActorRole,
  AuthorityContext,
  EvidenceReference,
  EvidenceReferenceType,
  ProvenanceMetadata,
  RecordLike,
  ReviewWorkflowType,
  TransitionProvenanceEvent,
  TransitionValidationResult,
  WorkflowEvent,
  WorkflowState,
} from "./types";

const PROVENANCE_REDACTION_SUMMARY =
  "Evidence provenance is metadata-only. Raw Firestore IDs, storage paths, provider payloads, tokens, credentials, request bodies, response bodies, and sensitive field dumps are excluded.";

const RESTRICTED_VALUE_PATTERN =
  /token|secret|credential|authorization|cookie|password|bearer|provider payload|raw report|request body|response body|stacktrace|stack trace|gs:\/\/|storage\.googleapis\.com/i;

export function stableProvenanceHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 20);
}

export function provenanceMetadata(): ProvenanceMetadata {
  return {
    metadataOnly: true,
    appendOnly: true,
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    landlordVisible: false,
    source: "state_machine_advisory",
    timestampFormat: "iso_8601_utc",
  };
}

export function toUtcIso(value?: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function safeProvenanceLabel(value: unknown, fallback: string, max = 120): string {
  const label = String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  if (!label || RESTRICTED_VALUE_PATTERN.test(label)) return fallback;
  if (/^[A-Za-z0-9_-]{16,}$/.test(label)) return fallback;
  return label;
}

export function safeReferenceKey(workflowType: ReviewWorkflowType, referenceType: EvidenceReferenceType, value: unknown): string {
  return `${workflowType}:${referenceType}:${stableProvenanceHash(value)}`;
}

export function workflowInstanceKey(workflowType: ReviewWorkflowType, instanceId: unknown): string {
  return `${workflowType}:instance:${stableProvenanceHash(instanceId)}`;
}

export function actorSummary(context: AuthorityContext): TransitionProvenanceEvent["actor"] {
  const actorId = String(context.actorId ?? "").trim();
  return {
    actorRole: context.actorRole,
    actorRef: actorId ? `actor:${stableProvenanceHash([context.actorRole, actorId])}` : null,
    rawActorIdsIncluded: false,
  };
}

function accessRef(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? `access:${stableProvenanceHash(raw)}` : null;
}

function contextValue(context: AuthorityContext & Record<string, unknown>, key: "landlordId" | "ownerId" | "tenantId"): unknown {
  return (context as Record<string, unknown>)[key];
}

export function buildEvidenceReference(input: {
  workflowType: ReviewWorkflowType;
  referenceType: EvidenceReferenceType;
  referenceId?: unknown;
  label?: unknown;
}): EvidenceReference | null {
  const referenceId = String(input.referenceId ?? "").trim();
  if (!referenceId) return null;
  return {
    referenceKey: safeReferenceKey(input.workflowType, input.referenceType, referenceId),
    referenceType: input.referenceType,
    label: safeProvenanceLabel(input.label, `${input.referenceType} reference`),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function compactEvidenceRefs(refs: Array<EvidenceReference | null | undefined>): EvidenceReference[] {
  const byKey = new Map<string, EvidenceReference>();
  for (const ref of refs) {
    if (!ref?.referenceKey) continue;
    byKey.set(ref.referenceKey, ref);
  }
  return [...byKey.values()].slice(0, 25);
}

export function readRecordId(record: RecordLike | null | undefined, fields: readonly string[]): string | null {
  if (!record) return null;
  for (const field of fields) {
    const value = String(record[field] ?? "").trim();
    if (value) return value;
  }
  return null;
}

export function hasRestrictedProvenanceContent(value: unknown): boolean {
  return RESTRICTED_VALUE_PATTERN.test(JSON.stringify(value ?? {}));
}

export function captureTransitionEvidence<S extends WorkflowState, E extends WorkflowEvent>(input: {
  workflowType: ReviewWorkflowType;
  workflowInstanceId: string;
  currentState: S;
  proposedState: S;
  event: E;
  context: AuthorityContext & Record<string, unknown>;
  validation: TransitionValidationResult<S>;
  evidenceRefs?: EvidenceReference[];
  occurredAt?: unknown;
}): TransitionProvenanceEvent<S, E> {
  const occurredAt = toUtcIso(input.occurredAt);
  const instanceKey = workflowInstanceKey(input.workflowType, input.workflowInstanceId);
  const refs = compactEvidenceRefs(input.evidenceRefs || []);
  return {
    eventId: `transition_provenance:${stableProvenanceHash([
      input.workflowType,
      instanceKey,
      input.currentState,
      input.proposedState,
      input.event,
      occurredAt,
      input.context.actorRole,
      input.context.actorId || null,
    ])}`,
    workflowType: input.workflowType,
    workflowInstanceKey: instanceKey,
    transition: {
      from: input.currentState,
      to: input.proposedState,
      event: input.event,
      outcome: input.validation.valid ? "valid" : "invalid",
      reason: input.validation.reason || null,
    },
    actor: actorSummary(input.context),
    access: {
      landlordRef: accessRef(contextValue(input.context, "landlordId") || contextValue(input.context, "ownerId")),
      tenantRef: accessRef(contextValue(input.context, "tenantId")),
      rawIdsIncluded: false,
    },
    occurredAt,
    evidenceRefs: refs,
    contextSummary: {
      requiredContextPresent: !input.validation.reason?.toLowerCase().includes("missing required context"),
      authorityResolved: input.context.authorized === true,
      evidenceRefCount: refs.length,
      rawPayloadIncluded: false,
    },
    metadata: provenanceMetadata(),
    immutable: true,
    redactionSummary: PROVENANCE_REDACTION_SUMMARY,
  };
}

export function validateProvenanceIntegrity(event: TransitionProvenanceEvent): { valid: boolean; reason?: string } {
  if (!event.immutable || event.metadata.appendOnly !== true || event.metadata.metadataOnly !== true) {
    return { valid: false, reason: "provenance_event_not_append_safe" };
  }
  if (!event.occurredAt.endsWith("Z") || Number.isNaN(Date.parse(event.occurredAt))) {
    return { valid: false, reason: "provenance_timestamp_not_iso_utc" };
  }
  if (event.metadata.tenantVisible || event.metadata.landlordVisible) {
    return { valid: false, reason: "provenance_visibility_not_internal" };
  }
  if (event.actor.rawActorIdsIncluded || event.contextSummary.rawPayloadIncluded) {
    return { valid: false, reason: "provenance_raw_identifier_or_payload_included" };
  }
  if (hasRestrictedProvenanceContent(event.evidenceRefs)) {
    return { valid: false, reason: "provenance_restricted_content_detected" };
  }
  return { valid: true };
}
