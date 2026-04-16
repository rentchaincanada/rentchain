import crypto from "crypto";
import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { addResolutionNote } from "../lib/resolution/addResolutionNote";
import { loadResolutionRecord } from "../lib/resolution/loadResolutionRecord";
import { saveResolutionRecord } from "../lib/resolution/saveResolutionRecord";
import type { ResolutionRecordV1, ResolutionStatus } from "../lib/resolution/resolutionTypes";
import { updateResolutionStatus } from "../lib/resolution/updateResolutionStatus";
import { RESOLUTION_TRANSITION_ERROR_CODE } from "../lib/resolution/validateResolutionTransition";
import { writeCanonicalEvent } from "../lib/events/buildEvent";

const router = Router();

const ALLOWED_STATUSES = new Set<ResolutionStatus>([
  "acknowledged",
  "in_progress",
  "resolved",
  "dismissed",
]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function actorFromReq(req: any) {
  return {
    id: asString(req.user?.uid || req.user?.id, 240) || null,
    role: asString(req.user?.actorRole || req.user?.role, 80) || null,
  };
}

async function emitResolutionEvent(input: {
  type: "resolution.created" | "resolution.status_changed" | "resolution.note_added";
  summary: string;
  resolution: ResolutionRecordV1;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await writeCanonicalEvent({
    type: input.type,
    domain: "system",
    action: input.type.split(".").slice(1).join("_"),
    status: input.resolution.status,
    actor: {
      type: "admin",
      id: input.actorId || null,
      role: input.actorRole || null,
    },
    resource: {
      type: "resolution",
      id: input.resolution.id,
      parentType: input.resolution.resource.type,
      parentId: input.resolution.resource.id,
    },
    occurredAt: new Date().toISOString(),
    visibility: "internal",
    summary: input.summary,
    metadata: {
      resolutionStatus: input.resolution.status,
      triageCategory: input.resolution.triage?.category || null,
      triageSeverity: input.resolution.triage?.severity || null,
      reasonCode: input.resolution.triage?.reasonCode || null,
      ...input.metadata,
    },
  });
}

function createResolutionRecord(input: {
  resourceType: string;
  resourceId: string;
  triageCategory?: string | null;
  triageSeverity?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
}): ResolutionRecordV1 {
  const now = new Date().toISOString();
  const note = asString(input.note, 4000);
  return {
    version: "v1",
    id: crypto.randomUUID(),
    resource: {
      type: asString(input.resourceType, 120),
      id: asString(input.resourceId, 240),
    },
    triage: {
      category: asString(input.triageCategory, 120) || null,
      severity: asString(input.triageSeverity, 120) || null,
      reasonCode: asString(input.reasonCode, 160) || null,
    },
    status: "open",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    dismissedAt: null,
    notes: note
      ? [
          {
            id: crypto.randomUUID(),
            createdAt: now,
            authorId: input.actorId || null,
            authorRole: input.actorRole || null,
            message: note,
          },
        ]
      : [],
    history: [
      {
        id: crypto.randomUUID(),
        timestamp: now,
        fromStatus: null,
        toStatus: "open",
        authorId: input.actorId || null,
        authorRole: input.actorRole || null,
        reason: "Resolution record created",
      },
    ],
    metadata: {},
  };
}

router.get("/resolutions", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resourceType = asString(req.query?.resourceType, 120);
    const resourceId = asString(req.query?.resourceId, 240);
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_REFERENCE_REQUIRED" });
    }
    const resolution = await loadResolutionRecord({ resourceType, resourceId });
    return res.json({ resolution: resolution || null });
  } catch (err: any) {
    console.error("[admin-resolution] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_RESOLUTION_FETCH_FAILED" });
  }
});

router.post("/resolutions", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resourceType = asString(req.body?.resourceType, 120);
    const resourceId = asString(req.body?.resourceId, 240);
    const triageCategory = asString(req.body?.triageCategory, 120) || null;
    const triageSeverity = asString(req.body?.triageSeverity, 120) || null;
    const reasonCode = asString(req.body?.reasonCode, 160) || null;
    const note = asString(req.body?.note, 4000) || null;
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_REFERENCE_REQUIRED" });
    }

    const actor = actorFromReq(req);
    let resolution = await loadResolutionRecord({ resourceType, resourceId, reasonCode });
    if (resolution && ["open", "acknowledged", "in_progress"].includes(resolution.status)) {
      if (note) {
        resolution = await addResolutionNote(resolution, {
          message: note,
          authorId: actor.id,
          authorRole: actor.role,
        });
        await emitResolutionEvent({
          type: "resolution.note_added",
          summary: `Resolution note added for ${resourceType} ${resourceId}.`,
          resolution,
          actorId: actor.id,
          actorRole: actor.role,
          metadata: { noteAddedOnUpsert: true },
        });
      }
      return res.json({ resolution });
    }

    resolution = createResolutionRecord({
      resourceType,
      resourceId,
      triageCategory,
      triageSeverity,
      reasonCode,
      note,
      actorId: actor.id,
      actorRole: actor.role,
    });
    await saveResolutionRecord(resolution);
    await emitResolutionEvent({
      type: "resolution.created",
      summary: `Resolution created for ${resourceType} ${resourceId}.`,
      resolution,
      actorId: actor.id,
      actorRole: actor.role,
    });
    return res.status(201).json({ resolution });
  } catch (err: any) {
    console.error("[admin-resolution] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_RESOLUTION_CREATE_FAILED" });
  }
});

router.patch("/resolutions/:resolutionId/status", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resolutionId = asString(req.params?.resolutionId, 240);
    const nextStatus = asString(req.body?.status, 80) as ResolutionStatus;
    const reason = asString(req.body?.reason, 1000) || null;
    if (!resolutionId || !ALLOWED_STATUSES.has(nextStatus)) {
      return res.status(400).json({ ok: false, error: "RESOLUTION_STATUS_INVALID" });
    }

    const snap = await db.collection("adminResolutions").doc(resolutionId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "RESOLUTION_NOT_FOUND" });
    }
    const record = { id: snap.id, ...(snap.data() || {}) } as ResolutionRecordV1;
    const actor = actorFromReq(req);
    const resolution = await updateResolutionStatus(record, {
      status: nextStatus,
      reason,
      authorId: actor.id,
      authorRole: actor.role,
    });
    await emitResolutionEvent({
      type: "resolution.status_changed",
      summary: `Resolution status changed to ${nextStatus} for ${record.resource.type} ${record.resource.id}.`,
      resolution,
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { fromStatus: record.status, toStatus: nextStatus, reason },
    });
    return res.json({ resolution });
  } catch (err: any) {
    if (err?.code === RESOLUTION_TRANSITION_ERROR_CODE) {
      return res.status(400).json({ ok: false, error: err.code, message: err.message });
    }
    console.error("[admin-resolution] status update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_RESOLUTION_STATUS_UPDATE_FAILED" });
  }
});

router.post("/resolutions/:resolutionId/notes", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resolutionId = asString(req.params?.resolutionId, 240);
    const message = asString(req.body?.message, 4000);
    if (!resolutionId || !message) {
      return res.status(400).json({ ok: false, error: "RESOLUTION_NOTE_MESSAGE_REQUIRED" });
    }
    const snap = await db.collection("adminResolutions").doc(resolutionId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "RESOLUTION_NOT_FOUND" });
    }
    const record = { id: snap.id, ...(snap.data() || {}) } as ResolutionRecordV1;
    const actor = actorFromReq(req);
    const resolution = await addResolutionNote(record, {
      message,
      authorId: actor.id,
      authorRole: actor.role,
    });
    await emitResolutionEvent({
      type: "resolution.note_added",
      summary: `Resolution note added for ${record.resource.type} ${record.resource.id}.`,
      resolution,
      actorId: actor.id,
      actorRole: actor.role,
    });
    return res.json({ resolution });
  } catch (err: any) {
    console.error("[admin-resolution] note add failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_RESOLUTION_NOTE_ADD_FAILED" });
  }
});

export default router;
