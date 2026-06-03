import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import {
  buildInstitutionalSharingRoom,
  normalizeInstitutionalSharingRoom,
  parseSharingRoomCreateRequest,
  revokeInstitutionalSharingRoom,
} from "../lib/sharingRooms/buildInstitutionalSharingRoom";
import {
  INSTITUTIONAL_SHARING_ROOMS_COLLECTION,
  type InstitutionalSharingRoom,
  type SharingRoomEventType,
} from "../lib/sharingRooms/sharingRoomTypes";

const router = Router();

function asString(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function actorFromReq(req: any): InstitutionalSharingRoom["createdBy"] {
  const role = asString(req.user?.role || req.user?.actorRole, 80).toLowerCase();
  return {
    userId: asString(req.user?.uid || req.user?.id || req.user?.sub, 240) || null,
    role: role === "admin" ? "admin" : role === "operator" ? "operator" : "landlord",
    email: asString(req.user?.email, 320) || null,
  };
}

function eventIdFor(input: { eventType: SharingRoomEventType; sharingRoomId: string; at: string }) {
  return [input.eventType, input.sharingRoomId, input.at]
    .join(":")
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function writeSharingRoomEvent(input: {
  eventType: SharingRoomEventType;
  room: InstitutionalSharingRoom;
  actor: InstitutionalSharingRoom["createdBy"];
  summary: string;
}) {
  const occurredAt = input.room.updatedAt || new Date().toISOString();
  await writeCanonicalEvent({
    id: eventIdFor({ eventType: input.eventType, sharingRoomId: input.room.sharingRoomId, at: occurredAt }),
    type: input.eventType,
    domain: "system",
    action: input.eventType,
    status: input.room.status,
    actor: {
      type: input.actor.role === "admin" ? "admin" : "landlord",
      id: input.actor.userId,
      role: input.actor.role,
      displayName: input.actor.email || null,
    },
    resource: {
      type: "institutional_sharing_room",
      id: input.room.sharingRoomId,
      parentType: "landlord",
      parentId: input.room.landlordId,
    },
    occurredAt,
    visibility: "landlord",
    summary: input.summary,
    metadata: {
      landlordId: input.room.landlordId,
      roomType: input.room.roomType,
      manualReviewRequired: true,
      publiclyAccessible: false,
      externalExecutionEnabled: false,
      tokenizationEnabled: false,
    },
    tags: ["institutional_sharing_room", input.room.roomType],
  });
}

async function loadRoomForLandlord(sharingRoomId: string, landlordId: string) {
  const snap = await db.collection(INSTITUTIONAL_SHARING_ROOMS_COLLECTION).doc(sharingRoomId).get();
  if (!snap.exists) return null;
  const room = normalizeInstitutionalSharingRoom({ id: snap.id, ...((snap.data() as any) || {}) });
  if (!room || room.landlordId !== landlordId) return null;
  return room;
}

router.get("/sharing-rooms", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db.collection(INSTITUTIONAL_SHARING_ROOMS_COLLECTION).where("landlordId", "==", landlordId).get();
    const rooms = (snap.docs || [])
      .map((doc: any) => normalizeInstitutionalSharingRoom({ id: doc.id, ...((doc.data() as any) || {}) }))
      .filter((room): room is InstitutionalSharingRoom => Boolean(room))
      .sort((a: InstitutionalSharingRoom, b: InstitutionalSharingRoom) => b.updatedAt.localeCompare(a.updatedAt));
    return res.json({ ok: true, rooms });
  } catch (err: any) {
    console.error("[landlordSharingRoomRoutes] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SHARING_ROOM_LIST_FAILED" });
  }
});

router.post("/sharing-rooms", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const request = parseSharingRoomCreateRequest(req.body);
    if (!landlordId || !request) return res.status(400).json({ ok: false, error: "SHARING_ROOM_CREATE_INVALID" });
    const actor = actorFromReq(req);
    const room = buildInstitutionalSharingRoom({ landlordId, request, actor });
    await db.collection(INSTITUTIONAL_SHARING_ROOMS_COLLECTION).doc(room.sharingRoomId).set(room, { merge: false });
    await writeSharingRoomEvent({
      eventType: "institutional_sharing_room_created",
      room,
      actor,
      summary: `Institutional sharing room created for ${room.roomType}.`,
    });
    await writeSharingRoomEvent({
      eventType: "institutional_sharing_room_review_required",
      room,
      actor,
      summary: "Manual review is required before institutional access can be relied on.",
    });
    return res.status(201).json({ ok: true, room });
  } catch (err: any) {
    console.error("[landlordSharingRoomRoutes] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SHARING_ROOM_CREATE_FAILED" });
  }
});

router.get("/sharing-rooms/:sharingRoomId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const sharingRoomId = decodeURIComponent(asString(req.params?.sharingRoomId, 500));
    if (!landlordId || !sharingRoomId) return res.status(400).json({ ok: false, error: "SHARING_ROOM_ID_REQUIRED" });
    const room = await loadRoomForLandlord(sharingRoomId, landlordId);
    if (!room) return res.status(404).json({ ok: false, error: "SHARING_ROOM_NOT_FOUND" });
    return res.json({ ok: true, room });
  } catch (err: any) {
    console.error("[landlordSharingRoomRoutes] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SHARING_ROOM_GET_FAILED" });
  }
});

router.post("/sharing-rooms/:sharingRoomId/revoke", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const sharingRoomId = decodeURIComponent(asString(req.params?.sharingRoomId, 500));
    if (!landlordId || !sharingRoomId) return res.status(400).json({ ok: false, error: "SHARING_ROOM_ID_REQUIRED" });
    const existing = await loadRoomForLandlord(sharingRoomId, landlordId);
    if (!existing) return res.status(404).json({ ok: false, error: "SHARING_ROOM_NOT_FOUND" });
    const actor = actorFromReq(req);
    const room = revokeInstitutionalSharingRoom({ room: existing });
    await db.collection(INSTITUTIONAL_SHARING_ROOMS_COLLECTION).doc(room.sharingRoomId).set(room, { merge: false });
    await writeSharingRoomEvent({
      eventType: "institutional_sharing_room_access_revoked",
      room,
      actor,
      summary: "Institutional sharing room access revoked.",
    });
    return res.json({ ok: true, room });
  } catch (err: any) {
    console.error("[landlordSharingRoomRoutes] revoke failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SHARING_ROOM_REVOKE_FAILED" });
  }
});

export default router;
