import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { appendCanonicalAuditEvent, safeAuditReference } from "../lib/canonicalAudit/appendCanonicalAuditEvent";
import {
  addOperatorReviewNote,
  buildOperatorReviewManualMetadata,
  buildOperatorReviewSession,
  closeOperatorReviewSession,
  normalizeOperatorReviewManualMetadata,
  normalizeOperatorReviewActor,
  normalizeOperatorReviewSession,
  parseOperatorReviewManualMetadataUpdateRequest,
  parseOperatorReviewCloseRequest,
  parseOperatorReviewNoteRequest,
  parseOperatorReviewOpenRequest,
} from "../lib/operatorReviews/buildOperatorReviewSession";
import {
  OPERATOR_REVIEW_MANUAL_METADATA_COLLECTION,
  OPERATOR_REVIEW_SESSIONS_COLLECTION,
  type OperatorReviewEventType,
  type OperatorReviewManualMetadata,
  type OperatorReviewScope,
  type OperatorReviewSession,
} from "../lib/operatorReviews/operatorReviewTypes";
import type { CanonicalAuditEventType } from "../types/canonicalAuditEvent";

const router = Router();

function asString(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function actorFromReq(req: any) {
  const role = asString(req.user?.role || req.user?.actorRole, 80).toLowerCase();
  return normalizeOperatorReviewActor({
    userId: asString(req.user?.uid || req.user?.id || req.user?.sub, 240) || null,
    role: role === "admin" ? "admin" : role === "operator" ? "operator" : "landlord",
    email: asString(req.user?.email, 320) || null,
  });
}

function auditEventTypeFor(eventType: OperatorReviewEventType): CanonicalAuditEventType {
  if (eventType === "operator_review_session_opened") return "operator_review_opened";
  return eventType;
}

async function writeReviewEvent(input: {
  eventType: OperatorReviewEventType;
  session: OperatorReviewSession;
  actor: ReturnType<typeof actorFromReq>;
  summary: string;
}) {
  const occurredAt = input.session.updatedAt || new Date().toISOString();
  await appendCanonicalAuditEvent({
    eventType: auditEventTypeFor(input.eventType),
    actor: {
      role: input.actor.role,
      operatorRef: input.actor.userId,
      rawIdsIncluded: false,
    },
    authority: {
      role: input.actor.role,
      landlordRef: input.session.landlordId,
      supportAllowed: false,
      rawIdsIncluded: false,
    },
    sourceReferenceId: input.session.reviewSessionId,
    timestamp: occurredAt,
    visibility: "landlord_operator_internal",
    metadata: {
      reviewSessionId: safeAuditReference("review_session", input.session.reviewSessionId),
      scope: input.session.scope,
      scopeId: safeAuditReference("review_scope", input.session.scopeId),
      reviewStatus: input.session.status,
      noteSummary: input.summary,
      outcome: input.session.outcome?.result || null,
      manualOnly: true,
      metadataOnly: true,
      rawIdsIncluded: false,
    },
  });
}

async function writeManualMetadataEvent(input: {
  metadata: OperatorReviewManualMetadata;
  previous: OperatorReviewManualMetadata | null;
  actor: ReturnType<typeof actorFromReq>;
}) {
  await appendCanonicalAuditEvent({
    eventType: "operator_review_manual_metadata_updated",
    actor: {
      role: input.actor.role,
      operatorRef: input.actor.userId,
      rawIdsIncluded: false,
    },
    authority: {
      role: input.actor.role,
      landlordRef: input.metadata.landlordId,
      supportAllowed: false,
      rawIdsIncluded: false,
    },
    sourceReferenceId: input.metadata.manualMetadataId,
    timestamp: input.metadata.updatedAt,
    visibility: "landlord_operator_internal",
    metadata: {
      reviewSessionId: safeAuditReference("manual_review_metadata", input.metadata.manualMetadataId),
      scope: input.metadata.scope,
      scopeId: safeAuditReference("review_scope", input.metadata.scopeId),
      reviewStatus: input.metadata.reviewStatus,
      assignmentTarget: input.metadata.assignmentTarget,
      previousReviewStatus: input.previous?.reviewStatus || null,
      previousAssignmentTarget: input.previous?.assignmentTarget || null,
      noteSummary: "Manual review metadata updated.",
      manualOnly: true,
      metadataOnly: true,
      rawIdsIncluded: false,
    },
  });
}

async function loadSessionForLandlord(reviewSessionId: string, landlordId: string) {
  const snap = await db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).doc(reviewSessionId).get();
  if (!snap.exists) return null;
  const session = normalizeOperatorReviewSession({ id: snap.id, ...((snap.data() as any) || {}) });
  if (!session || session.landlordId !== landlordId) return null;
  return session;
}

async function loadManualMetadataForLandlord(manualMetadataId: string, landlordId: string) {
  const snap = await db.collection(OPERATOR_REVIEW_MANUAL_METADATA_COLLECTION).doc(manualMetadataId).get();
  if (!snap.exists) return null;
  const metadata = normalizeOperatorReviewManualMetadata({ id: snap.id, ...((snap.data() as any) || {}) });
  if (!metadata || metadata.landlordId !== landlordId) return null;
  return metadata;
}

router.get("/operator-reviews", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const scope = asString(req.query?.scope, 80) as OperatorReviewScope;
    const scopeId = asString(req.query?.scopeId, 500);
    let query: any = db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).where("landlordId", "==", landlordId);
    if (scope) query = query.where("scope", "==", scope);
    if (scopeId) query = query.where("scopeId", "==", scopeId);
    const snap = await query.get();
    const sessions = (snap.docs || [])
      .map((doc: any) => normalizeOperatorReviewSession({ id: doc.id, ...((doc.data() as any) || {}) }))
      .filter(Boolean)
      .sort((a: OperatorReviewSession, b: OperatorReviewSession) => b.updatedAt.localeCompare(a.updatedAt));
    return res.json({ ok: true, sessions });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_LIST_FAILED" });
  }
});

router.post("/operator-reviews", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const request = parseOperatorReviewOpenRequest(req.body);
    if (!landlordId || !request) return res.status(400).json({ ok: false, error: "OPERATOR_REVIEW_OPEN_INVALID" });
    const actor = actorFromReq(req);
    const session = buildOperatorReviewSession({ landlordId, request, actor });
    const existing = await loadSessionForLandlord(session.reviewSessionId, landlordId);
    if (existing && existing.status === "open") {
      return res.json({ ok: true, session: existing, existing: true });
    }
    await db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).doc(session.reviewSessionId).set(session, { merge: false });
    await writeReviewEvent({
      eventType: "operator_review_session_opened",
      session,
      actor,
      summary: `Operator review opened for ${session.scope}.`,
    });
    return res.status(201).json({ ok: true, session, existing: false });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] open failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_OPEN_FAILED" });
  }
});

router.get("/operator-reviews/manual-metadata", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const scope = asString(req.query?.scope, 80) as OperatorReviewScope;
    const scopeId = asString(req.query?.scopeId, 500);
    let query: any = db.collection(OPERATOR_REVIEW_MANUAL_METADATA_COLLECTION).where("landlordId", "==", landlordId);
    if (scope) query = query.where("scope", "==", scope);
    if (scopeId) query = query.where("scopeId", "==", scopeId);
    const snap = await query.get();
    const metadata = (snap.docs || [])
      .map((doc: any) => normalizeOperatorReviewManualMetadata({ id: doc.id, ...((doc.data() as any) || {}) }))
      .filter(Boolean)
      .sort((a: OperatorReviewManualMetadata, b: OperatorReviewManualMetadata) => b.updatedAt.localeCompare(a.updatedAt));
    return res.json({ ok: true, metadata });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] manual metadata list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_MANUAL_METADATA_LIST_FAILED" });
  }
});

router.put("/operator-reviews/manual-metadata", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const request = parseOperatorReviewManualMetadataUpdateRequest(req.body);
    if (!landlordId || !request) {
      return res.status(400).json({ ok: false, error: "OPERATOR_REVIEW_MANUAL_METADATA_INVALID" });
    }
    const actor = actorFromReq(req);
    const manualMetadataId = buildOperatorReviewManualMetadata({ landlordId, request, actor }).manualMetadataId;
    const previous = await loadManualMetadataForLandlord(manualMetadataId, landlordId);
    const metadata = buildOperatorReviewManualMetadata({
      landlordId,
      request,
      actor,
      existing: previous,
    });
    await db.collection(OPERATOR_REVIEW_MANUAL_METADATA_COLLECTION).doc(metadata.manualMetadataId).set(metadata, { merge: false });
    await writeManualMetadataEvent({ metadata, previous, actor });
    return res.json({ ok: true, metadata });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] manual metadata update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_MANUAL_METADATA_UPDATE_FAILED" });
  }
});

router.get("/operator-reviews/:reviewSessionId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const reviewSessionId = decodeURIComponent(asString(req.params?.reviewSessionId, 500));
    if (!landlordId || !reviewSessionId) return res.status(400).json({ ok: false, error: "OPERATOR_REVIEW_ID_REQUIRED" });
    const session = await loadSessionForLandlord(reviewSessionId, landlordId);
    if (!session) return res.status(404).json({ ok: false, error: "OPERATOR_REVIEW_NOT_FOUND" });
    return res.json({ ok: true, session });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_GET_FAILED" });
  }
});

router.post("/operator-reviews/:reviewSessionId/notes", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const reviewSessionId = decodeURIComponent(asString(req.params?.reviewSessionId, 500));
    const request = parseOperatorReviewNoteRequest(req.body);
    if (!landlordId || !reviewSessionId || !request) {
      return res.status(400).json({ ok: false, error: "OPERATOR_REVIEW_NOTE_INVALID" });
    }
    const existing = await loadSessionForLandlord(reviewSessionId, landlordId);
    if (!existing) return res.status(404).json({ ok: false, error: "OPERATOR_REVIEW_NOT_FOUND" });
    if (existing.status !== "open") return res.status(409).json({ ok: false, error: "OPERATOR_REVIEW_CLOSED" });
    const actor = actorFromReq(req);
    const session = addOperatorReviewNote({ session: existing, note: request.note, actor });
    await db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).doc(session.reviewSessionId).set(session, { merge: false });
    await writeReviewEvent({
      eventType: "operator_review_note_added",
      session,
      actor,
      summary: "Operator review note added.",
    });
    return res.json({ ok: true, session, note: session.notes[session.notes.length - 1] });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] note failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_NOTE_FAILED" });
  }
});

router.post("/operator-reviews/:reviewSessionId/close", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const reviewSessionId = decodeURIComponent(asString(req.params?.reviewSessionId, 500));
    const request = parseOperatorReviewCloseRequest(req.body);
    if (!landlordId || !reviewSessionId || !request) {
      return res.status(400).json({ ok: false, error: "OPERATOR_REVIEW_CLOSE_INVALID" });
    }
    const existing = await loadSessionForLandlord(reviewSessionId, landlordId);
    if (!existing) return res.status(404).json({ ok: false, error: "OPERATOR_REVIEW_NOT_FOUND" });
    if (existing.status !== "open") return res.status(409).json({ ok: false, error: "OPERATOR_REVIEW_ALREADY_CLOSED" });
    const actor = actorFromReq(req);
    const session = closeOperatorReviewSession({ session: existing, request, actor });
    await db.collection(OPERATOR_REVIEW_SESSIONS_COLLECTION).doc(session.reviewSessionId).set(session, { merge: false });
    await writeReviewEvent({
      eventType: "operator_review_outcome_recorded",
      session,
      actor,
      summary: `Operator review outcome recorded: ${session.outcome?.result || "unresolved"}.`,
    });
    await writeReviewEvent({
      eventType: "operator_review_session_closed",
      session,
      actor,
      summary: `Operator review closed with ${session.status} status.`,
    });
    return res.json({ ok: true, session });
  } catch (err: any) {
    console.error("[landlordOperatorReviewRoutes] close failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "OPERATOR_REVIEW_CLOSE_FAILED" });
  }
});

export default router;
