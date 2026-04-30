import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireLandlord } from "../middleware/requireLandlord";
import { requireAuth } from "../middleware/requireAuth";
import { db, FieldValue } from "../config/firebase";
import { requireCapability } from "../services/capabilityGuard";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();
router.use(authenticateJwt);

type Role = "landlord" | "tenant";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    propertyId: data.propertyId || null,
    unitId: data.unitId || null,
    lastMessageAt: toMillis(data.lastMessageAt) || null,
    lastReadAtLandlord: toMillis(data.lastReadAtLandlord) || null,
    lastReadAtTenant: toMillis(data.lastReadAtTenant) || null,
    createdAt: toMillis(data.createdAt) || null,
  };
}

function normalizeUnitLabel(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return /^unit\b/i.test(raw) ? raw : `Unit ${raw}`;
}

function buildPropertyLabel(property: any) {
  return stringOrNull(property?.name) || stringOrNull(property?.addressLine1) || null;
}

function buildTenantLabel(tenant: any) {
  return stringOrNull(tenant?.fullName) || stringOrNull(tenant?.name) || null;
}

async function lookupPropertyIdForUnit(unitId: string | null) {
  const target = stringOrNull(unitId);
  if (!target) return null;
  try {
    const unitSnap = await db.collection("units").doc(target).get();
    if (!unitSnap.exists) return null;
    return stringOrNull((unitSnap.data() as any)?.propertyId);
  } catch {
    return null;
  }
}

async function enrichConversationDisplay<T extends ReturnType<typeof normalizeConversation>>(conversations: T[]) {
  const unitIds = Array.from(
    new Set(conversations.map((conversation) => stringOrNull(conversation.unitId)).filter(Boolean))
  ) as string[];

  const tenantIds = Array.from(
    new Set(conversations.map((conversation) => stringOrNull(conversation.tenantId)).filter(Boolean))
  ) as string[];

  const [tenants, units] = await Promise.all([
    Promise.all(
      tenantIds.map(async (tenantId) => {
        const snap = await db.collection("tenants").doc(tenantId).get();
        return [tenantId, snap.exists ? buildTenantLabel(snap.data() as any) : null] as const;
      })
    ),
    Promise.all(
      unitIds.map(async (unitId) => {
        const snap = await db.collection("units").doc(unitId).get();
        const raw = snap.exists ? (snap.data() as any) : null;
        return [
          unitId,
          {
            raw,
            label: raw ? normalizeUnitLabel(raw?.unitNumber || raw?.unitLabel || raw?.label || raw?.name) : null,
          },
        ] as const;
      })
    ),
  ]);

  const tenantNameById = new Map<string, string | null>(tenants);
  const unitById = new Map<string, { raw: any; label: string | null }>(units);
  const propertyIds = Array.from(
    new Set(
      conversations
        .map((conversation) => {
          const direct = stringOrNull((conversation as any).propertyId);
          if (direct) return direct;
          const unitId = stringOrNull(conversation.unitId);
          return unitId ? stringOrNull(unitById.get(unitId)?.raw?.propertyId) : null;
        })
        .filter(Boolean)
    )
  ) as string[];
  const properties = await Promise.all(
    propertyIds.map(async (propertyId) => {
      const snap = await db.collection("properties").doc(propertyId).get();
      return [propertyId, snap.exists ? (snap.data() as any) : null] as const;
    })
  );
  const propertyById = new Map<string, any>(properties);

  return conversations.map((conversation) => {
    const unitId = stringOrNull(conversation.unitId);
    const resolvedUnit = unitId ? unitById.get(unitId) : null;
    const propertyId =
      stringOrNull((conversation as any).propertyId) ||
      stringOrNull(resolvedUnit?.raw?.propertyId);
    const property = propertyId ? propertyById.get(propertyId) : null;
    const fallbackUnitFromProperty = Array.isArray(property?.units)
      ? property.units.find((unit: any) => {
          const candidateId = stringOrNull(unit?.id) || stringOrNull(unit?.unitId) || stringOrNull(unit?.uid);
          return candidateId && unitId && candidateId === unitId;
        })
      : null;

    return {
      ...conversation,
      tenantDisplayName: tenantNameById.get(String(conversation.tenantId || "").trim()) || null,
      propertyDisplayLabel: buildPropertyLabel(property),
      unitDisplayLabel:
        resolvedUnit?.label ||
        normalizeUnitLabel(
          fallbackUnitFromProperty?.unitNumber ||
            fallbackUnitFromProperty?.label ||
            fallbackUnitFromProperty?.name
        ) ||
        null,
    };
  });
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => emailRegex.test(value))
    )
  );
}

function stringOrNull(value: any) {
  const next = String(value || "").trim();
  return next || null;
}

async function lookupUserEmail(userId: string | null) {
  const id = stringOrNull(userId);
  if (!id) return null;
  try {
    const userSnap = await db.collection("users").doc(id).get();
    if (userSnap.exists) {
      return stringOrNull((userSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupLandlordEmail(landlordId: string | null) {
  const direct = await lookupUserEmail(landlordId);
  if (direct) return direct;
  const id = stringOrNull(landlordId);
  if (!id) return null;
  try {
    const landlordSnap = await db.collection("landlords").doc(id).get();
    if (landlordSnap.exists) {
      return stringOrNull((landlordSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupTenantEmail(tenantId: string | null) {
  const id = stringOrNull(tenantId);
  if (!id) return null;
  try {
    const tenantSnap = await db.collection("tenants").doc(id).get();
    if (tenantSnap.exists) {
      return stringOrNull((tenantSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function sendConversationMessageEmail(params: {
  conversation: any;
  senderRole: Role;
  body: string;
}) {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    process.env.FROM_EMAIL;
  if (!from) return;

  const recipientEmail =
    params.senderRole === "landlord"
      ? await lookupTenantEmail(params.conversation.tenantId)
      : await lookupLandlordEmail(params.conversation.landlordId);
  if (!recipientEmail || !emailRegex.test(recipientEmail)) return;

  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const threadPath = params.senderRole === "landlord" ? "/tenant/messages" : "/messages";
  const subjectPrefix = params.senderRole === "landlord" ? "New message from your landlord" : "New tenant message";
  const contextBits = [
    stringOrNull(params.conversation.propertyId),
    stringOrNull(params.conversation.unitId),
  ].filter(Boolean);
  const preview = params.body.length > 280 ? `${params.body.slice(0, 280)}...` : params.body;

  await sendEmail({
    to: uniqueEmails([recipientEmail]),
    from,
    replyTo: from,
    subject: contextBits.length ? `${subjectPrefix} (${contextBits.join(" • ")})` : subjectPrefix,
    text: buildEmailText({
      intro: `${subjectPrefix}.\n\n${preview}`,
      ctaText: "Open messages",
      ctaUrl: `${baseUrl}${threadPath}`,
    }),
    html: buildEmailHtml({
      title: subjectPrefix,
      intro: preview,
      ctaText: "Open messages",
      ctaUrl: `${baseUrl}${threadPath}`,
    }),
  });
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

async function enforceMessagingCapability(req: any, landlordId: string, res: any): Promise<boolean> {
  if (String(req.user?.role || "").toLowerCase() === "admin") {
    return true;
  }
  const cap = await requireCapability(landlordId, "messaging", req.user);
  if (!cap.ok) {
    res.status(403).json({ ok: false, error: "Upgrade required", capability: "messaging", plan: cap.plan });
    return false;
  }
  return true;
}

/**
 * Landlord endpoints
 */
router.get("/landlord/messages/conversations", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  try {
    const snap = await db
      .collection("conversations")
      .where("landlordId", "==", landlordId)
      .orderBy("lastMessageAt", "desc")
      .limit(100)
      .get();

    const normalized = snap.docs.map(normalizeConversation);
    const items = (await enrichConversationDisplay(normalized)).map((c: any) => ({
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
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = (await enrichConversationDisplay([normalizeConversation(convoSnap)]))[0];
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
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  const id = String(req.params?.id || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "body required" });
  if (body.length > 4000) return res.status(400).json({ ok: false, error: "body too long" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = (await enrichConversationDisplay([normalizeConversation(convoSnap)]))[0];
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msg = await addMessage({ conversationId: id, senderRole: "landlord", body });
    try {
      await sendConversationMessageEmail({ conversation: convo, senderRole: "landlord", body });
    } catch (err: any) {
      console.error("[messages] landlord email send failed", {
        conversationId: id,
        landlordId,
        message: err?.message || "send_failed",
      });
    }
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[messages] landlord send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/landlord/messages/conversations/:id/read", requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
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
  return requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "tenant") {
      return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    }
    return next();
  });
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
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

  const docId = `${ctx.landlordId}__${ctx.tenantId}__${ctx.unitId || "na"}`;
  try {
    const ref = db.collection("conversations").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      const propertyId = await lookupPropertyIdForUnit(ctx.unitId);
      await ref.set({
        landlordId: ctx.landlordId,
        tenantId: ctx.tenantId,
        propertyId,
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
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

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
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;
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
    try {
      await sendConversationMessageEmail({ conversation: convo, senderRole: "tenant", body });
    } catch (err: any) {
      console.error("[messages] tenant email send failed", {
        conversationId: id,
        tenantId: ctx.tenantId,
        message: err?.message || "send_failed",
      });
    }
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
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

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
