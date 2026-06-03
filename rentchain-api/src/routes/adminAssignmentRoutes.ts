import { Router } from "express";
import { db } from "../firebase";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { loadAssignmentRecord, ADMIN_ASSIGNMENTS_COLLECTION } from "../lib/assignment/loadAssignmentRecord";
import { setAssignmentOwner } from "../lib/assignment/setAssignmentOwner";
import type { AssignmentRecordV1 } from "../lib/assignment/assignmentTypes";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

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

async function emitAssignmentEvent(input: {
  type: "assignment.set" | "assignment.changed" | "assignment.cleared";
  summary: string;
  assignment: AssignmentRecordV1;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await writeCanonicalEvent({
    type: input.type,
    domain: "system",
    action: input.type.split(".").slice(1).join("_"),
    actor: {
      type: "admin",
      id: input.actorId || null,
      role: input.actorRole || null,
    },
    resource: {
      type: "assignment",
      id: input.assignment.id,
      parentType: input.assignment.resource.type,
      parentId: input.assignment.resource.id,
    },
    occurredAt: new Date().toISOString(),
    visibility: "internal",
    summary: input.summary,
    metadata: {
      ownerId: input.assignment.currentOwner?.ownerId || null,
      ownerLabel: input.assignment.currentOwner?.ownerLabel || null,
      ...input.metadata,
    },
  });
}

router.get("/assignments", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resourceType = asString(req.query?.resourceType, 120);
    const resourceId = asString(req.query?.resourceId, 240);
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_REFERENCE_REQUIRED" });
    }
    const assignment = await loadAssignmentRecord({ resourceType, resourceId });
    return res.json({ assignment: assignment || null });
  } catch (err: any) {
    console.error("[admin-assignment] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_ASSIGNMENT_FETCH_FAILED" });
  }
});

router.post("/assignments", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const resourceType = asString(req.body?.resourceType, 120);
    const resourceId = asString(req.body?.resourceId, 240);
    const ownerId = asString(req.body?.ownerId, 240) || null;
    const ownerLabel = asString(req.body?.ownerLabel, 240) || null;
    const note = asString(req.body?.note, 2000) || null;
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_REFERENCE_REQUIRED" });
    }
    if (!ownerId) {
      return res.status(400).json({ ok: false, error: "OWNER_ID_REQUIRED" });
    }

    const existing = await loadAssignmentRecord({ resourceType, resourceId });
    const actor = actorFromReq(req);
    const assignment = await setAssignmentOwner({
      resourceType,
      resourceId,
      ownerId,
      ownerLabel,
      note,
      authorId: actor.id,
      authorRole: actor.role,
    });
    const latestAction = assignment.history.at(-1)?.action || "set";
    await emitAssignmentEvent({
      type: existing ? "assignment.changed" : "assignment.set",
      summary: `Assignment ${latestAction} for ${resourceType} ${resourceId}.`,
      assignment,
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { latestAction },
    });
    return res.status(existing ? 200 : 201).json({ assignment });
  } catch (err: any) {
    console.error("[admin-assignment] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_ASSIGNMENT_CREATE_FAILED" });
  }
});

router.patch("/assignments/:assignmentId", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const assignmentId = asString(req.params?.assignmentId, 240);
    if (!assignmentId) {
      return res.status(400).json({ ok: false, error: "ASSIGNMENT_ID_REQUIRED" });
    }

    const snap = await db.collection(ADMIN_ASSIGNMENTS_COLLECTION).doc(assignmentId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "ASSIGNMENT_NOT_FOUND" });
    }
    const existing = { id: snap.id, ...(snap.data() || {}) } as AssignmentRecordV1;
    const ownerId = req.body?.ownerId == null ? null : asString(req.body?.ownerId, 240) || null;
    const ownerLabel = req.body?.ownerLabel == null ? null : asString(req.body?.ownerLabel, 240) || null;
    const note = asString(req.body?.note, 2000) || null;
    const actor = actorFromReq(req);

    const assignment = await setAssignmentOwner({
      resourceType: existing.resource.type,
      resourceId: existing.resource.id,
      ownerId,
      ownerLabel,
      note,
      authorId: actor.id,
      authorRole: actor.role,
    });

    const latestAction = assignment.history.at(-1)?.action || "changed";
    await emitAssignmentEvent({
      type: latestAction === "cleared" ? "assignment.cleared" : latestAction === "set" ? "assignment.set" : "assignment.changed",
      summary: `Assignment ${latestAction} for ${existing.resource.type} ${existing.resource.id}.`,
      assignment,
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { latestAction },
    });
    return res.json({ assignment });
  } catch (err: any) {
    console.error("[admin-assignment] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_ASSIGNMENT_UPDATE_FAILED" });
  }
});

export default router;
