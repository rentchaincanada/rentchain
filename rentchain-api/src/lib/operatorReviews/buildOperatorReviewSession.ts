import crypto from "crypto";
import type {
  OperatorReviewActor,
  OperatorReviewCloseRequest,
  OperatorReviewEvidenceReference,
  OperatorReviewManualMetadata,
  OperatorReviewManualMetadataUpdateRequest,
  OperatorReviewNote,
  OperatorReviewNoteRequest,
  OperatorReviewOpenRequest,
  OperatorReviewOutcome,
  OperatorReviewOutcomeResult,
  OperatorManualAssignmentTarget,
  OperatorManualReviewStatus,
  OperatorReviewScope,
  OperatorReviewSession,
  OperatorReviewStatus,
} from "./operatorReviewTypes";

const VALID_SCOPES = new Set<OperatorReviewScope>([
  "decision",
  "workflow",
  "delinquency",
  "institution_export",
  "audit_compliance",
]);
const VALID_OUTCOMES = new Set<OperatorReviewOutcomeResult>([
  "reviewed",
  "needs_follow_up",
  "escalated",
  "blocked",
  "unresolved",
]);
const VALID_CLOSE_STATUSES = new Set<OperatorReviewStatus>(["completed", "escalated", "abandoned"]);
const VALID_MANUAL_REVIEW_STATUSES = new Set<OperatorManualReviewStatus>([
  "open",
  "needs_review",
  "in_review",
  "awaiting_information",
  "blocked",
  "resolved",
  "closed",
]);
const VALID_MANUAL_ASSIGNMENT_TARGETS = new Set<OperatorManualAssignmentTarget>([
  "unassigned",
  "operations",
  "property_manager",
  "finance_reviewer",
  "document_reviewer",
  "screening_reviewer",
]);

function asString(value: unknown, max = 1000): string {
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
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function sanitizeOperatorReviewNote(value: unknown): string {
  return asString(value, 1200).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

export function operatorReviewSessionId(input: {
  landlordId: string;
  scope: OperatorReviewScope;
  scopeId: string;
}): string {
  const clean = cleanIdPart(["operator_review", input.landlordId, input.scope, input.scopeId].join(":"));
  return clean || crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function operatorReviewManualMetadataId(input: {
  landlordId: string;
  scope: OperatorReviewScope;
  scopeId: string;
}): string {
  const clean = cleanIdPart(["operator_review_manual_metadata", input.landlordId, input.scope, input.scopeId].join(":"));
  return clean || crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function operatorReviewNoteId(input: {
  reviewSessionId: string;
  createdAt: string;
  actorId?: string | null;
  note: string;
}): string {
  return crypto
    .createHash("sha256")
    .update([input.reviewSessionId, input.createdAt, input.actorId || "", input.note].join(":"))
    .digest("hex");
}

export function normalizeOperatorReviewActor(raw: unknown): OperatorReviewActor {
  const data = (raw || {}) as Record<string, unknown>;
  const role = asString(data.role, 40).toLowerCase();
  return {
    userId: asString(data.userId, 240) || null,
    role: role === "admin" || role === "operator" ? role : "landlord",
    email: asString(data.email, 320) || null,
  };
}

export function normalizeEvidenceReferences(raw: unknown): OperatorReviewEvidenceReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const evidenceId = asString(data.evidenceId || data.id, 240);
      const label = asString(data.label, 160);
      const kind = asString(data.kind, 80) as OperatorReviewEvidenceReference["kind"];
      if (!evidenceId || !label) return null;
      return {
        evidenceId,
        label,
        kind: ["decision", "workflow", "ledger", "export_package", "audit_readiness"].includes(kind)
          ? kind
          : "unknown",
        destination: asString(data.destination, 500) || null,
      };
    })
    .filter(Boolean)
    .slice(0, 12) as OperatorReviewEvidenceReference[];
}

export function normalizeOperatorReviewSession(raw: unknown): OperatorReviewSession | null {
  const data = (raw || {}) as Record<string, unknown>;
  const reviewSessionId = asString(data.reviewSessionId || data.id, 240);
  const landlordId = asString(data.landlordId, 240);
  const scope = asString(data.scope, 80) as OperatorReviewScope;
  const scopeId = asString(data.scopeId, 500);
  const status = asString(data.status, 40) as OperatorReviewStatus;
  const openedAt = toIsoDate(data.openedAt);
  const updatedAt = toIsoDate(data.updatedAt) || openedAt;
  if (!reviewSessionId || !landlordId || !VALID_SCOPES.has(scope) || !scopeId || !openedAt || !updatedAt) {
    return null;
  }
  const notes = Array.isArray(data.notes)
    ? data.notes
        .map((rawNote) => {
          const note = (rawNote || {}) as Record<string, unknown>;
          const text = sanitizeOperatorReviewNote(note.text);
          const createdAt = toIsoDate(note.createdAt);
          const noteId = asString(note.noteId, 240);
          if (!noteId || !text || !createdAt) return null;
          return {
            noteId,
            text,
            createdAt,
            actor: normalizeOperatorReviewActor(note.actor),
          };
        })
        .filter(Boolean)
    : [];
  const rawOutcome = (data.outcome || null) as Record<string, unknown> | null;
  const outcome =
    rawOutcome && VALID_OUTCOMES.has(asString(rawOutcome.result, 80) as OperatorReviewOutcomeResult)
      ? {
          result: asString(rawOutcome.result, 80) as OperatorReviewOutcomeResult,
          summary: sanitizeOperatorReviewNote(rawOutcome.summary),
          recordedAt: toIsoDate(rawOutcome.recordedAt) || updatedAt,
          recordedBy: normalizeOperatorReviewActor(rawOutcome.recordedBy),
        }
      : null;
  return {
    reviewSessionId,
    landlordId,
    scope,
    scopeId,
    status: status === "completed" || status === "escalated" || status === "abandoned" ? status : "open",
    openedAt,
    closedAt: toIsoDate(data.closedAt),
    openedBy: normalizeOperatorReviewActor(data.openedBy),
    outcome,
    notes: notes as OperatorReviewNote[],
    linkedEvidence: normalizeEvidenceReferences(data.linkedEvidence),
    manualOnly: true,
    systemGenerated: false,
    updatedAt,
  };
}

export function normalizeOperatorReviewManualMetadata(raw: unknown): OperatorReviewManualMetadata | null {
  const data = (raw || {}) as Record<string, unknown>;
  const manualMetadataId = asString(data.manualMetadataId || data.id, 240);
  const landlordId = asString(data.landlordId, 240);
  const scope = asString(data.scope, 80) as OperatorReviewScope;
  const scopeId = asString(data.scopeId, 500);
  const reviewStatus = asString(data.reviewStatus, 80) as OperatorManualReviewStatus;
  const assignmentTarget = asString(data.assignmentTarget, 80) as OperatorManualAssignmentTarget;
  const createdAt = toIsoDate(data.createdAt);
  const updatedAt = toIsoDate(data.updatedAt) || createdAt;
  if (
    !manualMetadataId ||
    !landlordId ||
    !VALID_SCOPES.has(scope) ||
    !scopeId ||
    !VALID_MANUAL_REVIEW_STATUSES.has(reviewStatus) ||
    !VALID_MANUAL_ASSIGNMENT_TARGETS.has(assignmentTarget) ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    manualMetadataId,
    landlordId,
    scope,
    scopeId,
    reviewStatus,
    assignmentTarget,
    manualOnly: true,
    systemGenerated: false,
    createdAt,
    updatedAt,
    updatedBy: normalizeOperatorReviewActor(data.updatedBy),
  };
}

export function parseOperatorReviewOpenRequest(body: unknown): OperatorReviewOpenRequest | null {
  const data = (body || {}) as Record<string, unknown>;
  const scope = asString(data.scope, 80) as OperatorReviewScope;
  const scopeId = asString(data.scopeId, 500);
  if (!VALID_SCOPES.has(scope) || !scopeId) return null;
  return {
    scope,
    scopeId,
    linkedEvidence: normalizeEvidenceReferences(data.linkedEvidence),
    note: sanitizeOperatorReviewNote(data.note) || null,
  };
}

export function parseOperatorReviewManualMetadataUpdateRequest(
  body: unknown
): OperatorReviewManualMetadataUpdateRequest | null {
  const data = (body || {}) as Record<string, unknown>;
  const scope = asString(data.scope, 80) as OperatorReviewScope;
  const scopeId = asString(data.scopeId, 500);
  const reviewStatus = asString(data.reviewStatus, 80) as OperatorManualReviewStatus;
  const assignmentTarget = asString(data.assignmentTarget, 80) as OperatorManualAssignmentTarget;
  if (
    !VALID_SCOPES.has(scope) ||
    !scopeId ||
    !VALID_MANUAL_REVIEW_STATUSES.has(reviewStatus) ||
    !VALID_MANUAL_ASSIGNMENT_TARGETS.has(assignmentTarget)
  ) {
    return null;
  }
  return {
    scope,
    scopeId,
    reviewStatus,
    assignmentTarget,
  };
}

export function parseOperatorReviewNoteRequest(body: unknown): OperatorReviewNoteRequest | null {
  const note = sanitizeOperatorReviewNote((body as Record<string, unknown> | null)?.note);
  return note ? { note } : null;
}

export function parseOperatorReviewCloseRequest(body: unknown): OperatorReviewCloseRequest | null {
  const data = (body || {}) as Record<string, unknown>;
  const result = asString(data.result, 80) as OperatorReviewOutcomeResult;
  const summary = sanitizeOperatorReviewNote(data.summary);
  const status = asString(data.status, 80) as OperatorReviewStatus;
  if (!VALID_OUTCOMES.has(result) || !summary) return null;
  return {
    result,
    summary,
    status: VALID_CLOSE_STATUSES.has(status) ? status : result === "escalated" ? "escalated" : "completed",
  };
}

export function buildOperatorReviewSession(input: {
  landlordId: string;
  request: OperatorReviewOpenRequest;
  actor: OperatorReviewActor;
  now?: string;
}): OperatorReviewSession {
  const openedAt = toIsoDate(input.now) || new Date().toISOString();
  const reviewSessionId = operatorReviewSessionId({
    landlordId: input.landlordId,
    scope: input.request.scope,
    scopeId: input.request.scopeId,
  });
  const notes = input.request.note
    ? [
        buildOperatorReviewNote({
          reviewSessionId,
          note: input.request.note,
          actor: input.actor,
          now: openedAt,
        }),
      ]
    : [];
  return {
    reviewSessionId,
    landlordId: input.landlordId,
    scope: input.request.scope,
    scopeId: input.request.scopeId,
    status: "open",
    openedAt,
    closedAt: null,
    openedBy: input.actor,
    outcome: null,
    notes,
    linkedEvidence: input.request.linkedEvidence || [],
    manualOnly: true,
    systemGenerated: false,
    updatedAt: openedAt,
  };
}

export function buildOperatorReviewManualMetadata(input: {
  landlordId: string;
  request: OperatorReviewManualMetadataUpdateRequest;
  actor: OperatorReviewActor;
  existing?: OperatorReviewManualMetadata | null;
  now?: string;
}): OperatorReviewManualMetadata {
  const updatedAt = toIsoDate(input.now) || new Date().toISOString();
  return {
    manualMetadataId:
      input.existing?.manualMetadataId ||
      operatorReviewManualMetadataId({
        landlordId: input.landlordId,
        scope: input.request.scope,
        scopeId: input.request.scopeId,
      }),
    landlordId: input.landlordId,
    scope: input.request.scope,
    scopeId: input.request.scopeId,
    reviewStatus: input.request.reviewStatus,
    assignmentTarget: input.request.assignmentTarget,
    manualOnly: true,
    systemGenerated: false,
    createdAt: input.existing?.createdAt || updatedAt,
    updatedAt,
    updatedBy: input.actor,
  };
}

export function buildOperatorReviewNote(input: {
  reviewSessionId: string;
  note: string;
  actor: OperatorReviewActor;
  now?: string;
}): OperatorReviewNote {
  const createdAt = toIsoDate(input.now) || new Date().toISOString();
  const text = sanitizeOperatorReviewNote(input.note);
  return {
    noteId: operatorReviewNoteId({
      reviewSessionId: input.reviewSessionId,
      createdAt,
      actorId: input.actor.userId,
      note: text,
    }),
    text,
    createdAt,
    actor: input.actor,
  };
}

export function addOperatorReviewNote(input: {
  session: OperatorReviewSession;
  note: string;
  actor: OperatorReviewActor;
  now?: string;
}): OperatorReviewSession {
  const note = buildOperatorReviewNote({
    reviewSessionId: input.session.reviewSessionId,
    note: input.note,
    actor: input.actor,
    now: input.now,
  });
  return {
    ...input.session,
    notes: [...input.session.notes, note],
    updatedAt: note.createdAt,
  };
}

export function closeOperatorReviewSession(input: {
  session: OperatorReviewSession;
  request: OperatorReviewCloseRequest;
  actor: OperatorReviewActor;
  now?: string;
}): OperatorReviewSession {
  const closedAt = toIsoDate(input.now) || new Date().toISOString();
  const outcome: OperatorReviewOutcome = {
    result: input.request.result,
    summary: sanitizeOperatorReviewNote(input.request.summary),
    recordedAt: closedAt,
    recordedBy: input.actor,
  };
  return {
    ...input.session,
    status: input.request.status || (input.request.result === "escalated" ? "escalated" : "completed"),
    closedAt,
    outcome,
    updatedAt: closedAt,
  };
}
