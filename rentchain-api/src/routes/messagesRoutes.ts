import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireLandlord } from "../middleware/requireLandlord";
import { db, FieldValue } from "../config/firebase";

const router = Router();
router.use(authenticateJwt);

type Role = "landlord" | "tenant";

function toMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  return null;
}

function normalizeConversation(doc: any) {
  const data = doc.data() as any;
  const id = doc.id;
  return {
    id,
    landlordId: data.landlordId || null,
    tenantId: data.tenantId || null,
    unitId: data.unitId || null,
    lastMessageAt: toMillis(data.lastMessageAt) || null,
    lastReadAtLandlord: toMillis(data.lastReadAtLandlord) || null,
    lastReadAtTenant: toMillis(data.lastReadAtTenant) || null,
    createdAt: toMillis(data.createdAt) || null,
  };
}

async function addMessage(params: {
  conversationId: string;
  senderRole: Role;
  body: string;
}) {
  const { conversationId, senderRole, body } = params;
  const now = Date.now();
  const docRef = db.collection("messages").doc();
  await docRef.set({
    conversationId,
    senderRole,
    body,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });
  await db.collection("conversations").doc(conversationId).set(
    {
      lastMessageAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { id: docRef.id, conversationId, senderRole, body, createdAt: now };
}

/**
 * Landlord endpoints
 */
router.get("/landlord/messages/conversations", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  try {
    const snap = await db
      .collection("conversations")
      .where("landlordId", "==", landlordId)
      .orderBy("lastMessageAt", "desc")
      .limit(100)
      .get();

    const items = snap.docs.map(normalizeConversation).map((c: any) => ({
      ...c,
      hasUnread:
        c.lastMessageAt != null &&
        (c.lastReadAtLandlord == null || c.lastMessageAt > c.lastReadAtLandlord),
    }));

    return res.json({ ok: true, conversations: items });
  } catch (err: any) {
    console.error("[messages] landlord conversations error", err);
    return res.status(500).json({ ok: false, error: "Failed to list conversations" });
  }
});

router.get("/landlord/messages/conversations/:id", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msgSnap = await db
      .collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return res.json({ ok: true, conversation: convo, messages });
  } catch (err: any) {
    console.error("[messages] landlord convo messages error", err);
    return res.status(500).json({ ok: false, error: "Failed to load messages" });
  }
});

router.post("/landlord/messages/conversations/:id", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const id = String(req.params?.id || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "body required" });
  if (body.length > 4000) return res.status(400).json({ ok: false, error: "body too long" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msg = await addMessage({ conversationId: id, senderRole: "landlord", body });
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[messages] landlord send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/landlord/messages/conversations/:id/read", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const id = String(req.params?.id || "").trim();
  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    await db
      .collection("conversations")
      .doc(id)
      .set({ lastReadAtLandlord: FieldValue.serverTimestamp() }, { merge: true });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] landlord read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

/**
 * Tenant endpoints
 */
function requireTenant(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
  }
  return next();
}

function getTenantContext(req: any) {
  return {
    tenantId: req.user?.tenantId || req.user?.id || null,
    landlordId: req.user?.landlordId || null,
    unitId: req.user?.unitId || null,
  };
}

router.get("/tenant/messages/conversation", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const docId = `${ctx.landlordId}__${ctx.tenantId}__${ctx.unitId || "na"}`;
  try {
    const ref = db.collection("conversations").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        landlordId: ctx.landlordId,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId || null,
        createdAt: FieldValue.serverTimestamp(),
        lastMessageAt: null,
        lastReadAtLandlord: null,
        lastReadAtTenant: null,
      });
      const created = await ref.get();
      return res.json({ ok: true, conversation: normalizeConversation(created) });
    }
    return res.json({ ok: true, conversation: normalizeConversation(snap) });
  } catch (err: any) {
    console.error("[messages] tenant get/create conversation error", err);
    return res.status(500).json({ ok: false, error: "Failed to load conversation" });
  }
});

router.get("/tenant/messages/conversation/:id", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.tenantId !== ctx.tenantId || convo.landlordId !== ctx.landlordId) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const msgSnap = await db
      .collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return res.json({ ok: true, conversation: convo, messages });
  } catch (err: any) {
    console.error("[messages] tenant conversation error", err);
    return res.status(500).json({ ok: false, error: "Failed to load messages" });
  }
});

router.post("/tenant/messages/conversation/:id", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!body) return res.status(400).json({ ok: false, error: "body required" });
  if (body.length > 4000) return res.status(400).json({ ok: false, error: "body too long" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.tenantId !== ctx.tenantId || convo.landlordId !== ctx.landlordId) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const msg = await addMessage({ conversationId: id, senderRole: "tenant", body });
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[messages] tenant send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/tenant/messages/conversation/:id/read", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.tenantId !== ctx.tenantId || convo.landlordId !== ctx.landlordId) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    await db
      .collection("conversations")
      .doc(id)
      .set({ lastReadAtTenant: FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] tenant read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

export default router;
