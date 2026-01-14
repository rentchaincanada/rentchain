import { Router, Request, Response } from "express";
import { db, FieldValue } from "../config/firebase";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import sgMail from "@sendgrid/mail";
import { sendWaitlistConfirmation } from "../services/emailService";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireLandlord } from "../middleware/requireLandlord";
import { getTenantsList, getTenantDetailBundle } from "../services/tenantDetailsService";

const router = Router();

router.get("/health", (_req, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  res.json({ ok: true, service: "rentchain-api", ts: Date.now() });
});

router.get("/__probe/version", (_req, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  res.json({ ok: true, marker: "probe-v1", ts: Date.now() });
});

router.post("/notify-plan-interest", async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const emailRaw = String(req.body?.email || "").trim().toLowerCase();
  const planRaw = String(req.body?.plan || "").trim().toLowerCase();
  const noteRaw = String(req.body?.note || "").trim();

  if (!emailRaw || !emailRaw.includes("@")) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }
  if (planRaw !== "core" && planRaw !== "pro") {
    return res.status(400).json({ ok: false, error: "INVALID_PLAN" });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  const to = process.env.NOTIFY_PLAN_EMAIL || process.env.SUPPORT_EMAIL || from;

  if (!apiKey || !from || !to) {
    return res.json({ ok: true, emailed: false, emailError: "SendGrid not configured" });
  }

  try {
    sgMail.setApiKey(apiKey as string);
    const subject = `Plan interest: ${planRaw}`;
    const textLines = [
      `Email: ${emailRaw}`,
      `Plan: ${planRaw}`,
      noteRaw ? `Note: ${noteRaw}` : null,
      `Timestamp: ${new Date().toISOString()}`,
    ].filter(Boolean);

    await sgMail.send({
      to,
      from: from as string,
      subject,
      text: textLines.join("\n"),
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
      mailSettings: {
        footer: { enable: false },
      },
    });

    return res.json({ ok: true, emailed: true });
  } catch (e: any) {
    console.error("[notify-plan-interest] send failed", { email: emailRaw, plan: planRaw, message: e?.message });
    return res.json({ ok: true, emailed: false, emailError: String(e?.message || e) });
  }
});

router.get("/__probe/routes-lite", (_req, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  return res.json({
    ok: true,
    routes: ["/__probe/version", "/tenants", "/tenants/:tenantId"],
  });
});

router.get("/ready", (_req, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  res.json({ ok: true, ready: true, ts: Date.now() });
});

// In-memory rate limit (MVP ok)
const bucket = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 20;

function hit(ip: string) {
  const now = Date.now();
  const b = bucket.get(ip);
  if (!b || now > b.resetAt) {
    bucket.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true as const };
  }
  if (b.count >= MAX) {
    return {
      ok: false as const,
      retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
    };
  }
  b.count += 1;
  return { ok: true as const };
}

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

function emailKey(email: string) {
  return email
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 180);
}

async function handleWaitlist(req: Request, res: Response) {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const rl = hit(ip);
    if (!rl.ok) {
      return res
        .status(429)
        .json({
          ok: false,
          error: "Rate limited",
          retryAfterSec: rl.retryAfterSec,
        });
    }

    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || "").trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const docId = emailKey(email);
    const ref = db.collection("waitlist").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      // Optionally resend confirmation
      const emailSend = await sendWaitlistConfirmation({ to: email, name });
      if (!emailSend.ok) {
        console.warn("[POST /api/waitlist] resend failed:", emailSend.error);
      } else {
        console.log("[POST /api/waitlist] resend sent:", email);
      }
      return res.json({ ok: true, already: true });
    }

    const userAgent = String(req.headers["user-agent"] || "");
    await ref.set({
      email,
      name,
      createdAt: new Date().toISOString(),
      ip,
      userAgent,
      source: String(req.body?.source || "landing"),
      utm: req.body?.utm || null,
    });

    const emailSend = await sendWaitlistConfirmation({ to: email, name });
    if (!emailSend.ok) {
      console.warn("[POST /api/waitlist] confirmation email not sent:", emailSend.error);
    } else {
      console.log("[POST /api/waitlist] confirmation email sent:", email);
    }

    return res.json({ ok: true, already: false });
  } catch (e: any) {
    console.error("[POST /api/waitlist] error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

router.post("/waitlist", handleWaitlist);
router.post("/public/waitlist", handleWaitlist);

// Optional test endpoint for email verification (no auth guard; limit exposure if needed)
router.post("/waitlist/test-email", async (req: any, res) => {
  const to = String(req.body?.email || "").trim();
  if (!to) return res.status(400).json({ ok: false, error: "email required" });

  const name = String(req.body?.name || "Test").trim();
  const result = await sendWaitlistConfirmation({ to, name });
  return res.json({ ok: result.ok, error: (result as any).error || null });
});

router.get("/waitlist/health", (_req, res) => {
  res.json({
    ok: true,
    runtime: "vercel",
    checks: {
      SENDGRID_API_KEY: Boolean(process.env.SENDGRID_API_KEY),
      SENDGRID_FROM_EMAIL: Boolean(process.env.SENDGRID_FROM_EMAIL),
      SENDGRID_FROM: Boolean(process.env.SENDGRID_FROM),
      FROM_EMAIL: Boolean(process.env.FROM_EMAIL),
      SENDGRID_KEY: Boolean(process.env.SENDGRID_KEY),
    },
  });
});

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
    lastNotifiedAtLandlordMs: toMillis(data.lastNotifiedAtLandlordMs) || null,
    lastNotifiedAtTenantMs: toMillis(data.lastNotifiedAtTenantMs) || null,
  };
}

async function addMessage(params: { conversationId: string; senderRole: "landlord" | "tenant"; body: string }) {
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
  return { id: docRef.id, conversationId, senderRole, body, createdAt: now, createdAtMs: now };
}

async function notifyMessageRecipient(params: {
  convo: any;
  senderRole: "landlord" | "tenant";
  messageBody: string;
  requestUser?: any;
}) {
  const { convo, senderRole, messageBody, requestUser } = params;
  try {
    const recipientRole = senderRole === "landlord" ? "tenant" : "landlord";
    const now = Date.now();

    const lastRead =
      recipientRole === "tenant"
        ? convo.lastReadAtTenant
        : convo.lastReadAtLandlord;
    if (lastRead && now - lastRead < 2 * 60 * 1000) {
      return;
    }

    const lastNotified =
      recipientRole === "tenant"
        ? convo.lastNotifiedAtTenantMs
        : convo.lastNotifiedAtLandlordMs;
    if (lastNotified && now - lastNotified < 10 * 60 * 1000) {
      return;
    }

    const sgKey = String(process.env.SENDGRID_API_KEY || "").trim();
    const from =
      String(process.env.SENDGRID_FROM_EMAIL || "").trim() ||
      String(process.env.WAITLIST_FROM_EMAIL || "").trim();
    if (!sgKey || !from) {
      return;
    }
    sgMail.setApiKey(sgKey);

    let toEmail: string | null = null;
    if (recipientRole === "tenant") {
      toEmail = requestUser?.tenantEmail || requestUser?.email || null;
      if (!toEmail && convo?.tenantId) {
        try {
          const tenSnap = await db.collection("tenants").doc(convo.tenantId).get();
          if (tenSnap.exists) {
            const data = tenSnap.data() as any;
            toEmail = data?.email || data?.applicantEmail || null;
          }
        } catch {
          // ignore lookup error
        }
      }
    } else {
      toEmail = requestUser?.email || null;
      if (!toEmail && convo?.landlordId) {
        try {
          const userSnap = await db.collection("users").doc(convo.landlordId).get();
          if (userSnap.exists) {
            const udata = userSnap.data() as any;
            toEmail = udata?.email || null;
          }
        } catch {
          // ignore
        }
      }
    }
    if (!toEmail) return;

    const snippet = String(messageBody || "").slice(0, 140);
    const conversationId = convo.id;
    const link =
      recipientRole === "tenant"
        ? `https://www.rentchain.ai/tenant/messages?c=${conversationId}`
        : `https://www.rentchain.ai/messages?c=${conversationId}`;

    const subject = "New message on RentChain";
    const text = `You have a new message on RentChain:\n\n${snippet}\n\nOpen: ${link}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px 0;">New message on RentChain</h2>
        <p style="color:#111;">${snippet}</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Open conversation</a></p>
        <p style="color:#6b7280;font-size:12px;margin-top:18px;">If the button doesn’t work, copy and paste: ${link}</p>
      </div>
    `;

    await sgMail.send({
      to: toEmail,
      from,
      subject,
      text,
      html,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
      mailSettings: {
        footer: { enable: false },
      },
    });

    const update: any =
      recipientRole === "tenant"
        ? { lastNotifiedAtTenantMs: now }
        : { lastNotifiedAtLandlordMs: now };
    await db.collection("conversations").doc(conversationId).set(update, { merge: true });
  } catch (err) {
    console.warn("[messages notify] failed", { conversationId: convo?.id, err });
  }
}

function requireTenant(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
  }
  return next();
}

async function getTenantContext(req: any) {
  let tenantId = req.user?.tenantId || req.user?.id || null;
  let landlordId = req.user?.landlordId || null;
  let unitId = req.user?.unitId || null;

  if ((!landlordId || !unitId) && tenantId) {
    try {
      const snap = await db.collection("tenants").doc(tenantId).get();
      if (snap.exists) {
        const data = snap.data() as any;
        landlordId = landlordId || data?.landlordId || null;
        unitId = unitId || data?.unitId || data?.unit || null;
      }
    } catch (err) {
      console.warn("[publicRoutes] tenant context lookup failed", err);
    }
  }

  return { tenantId, landlordId, unitId };
}

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "14d" });
}

// Landlord-scoped tenants bridge (mounted under /api via publicRoutes)
router.get("/tenants", authenticateJwt, requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id || null;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const tenants = await getTenantsList({ landlordId });
    return res.status(200).json({ ok: true, tenants });
  } catch (err: any) {
    console.error("[publicRoutes] GET /tenants error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenants" });
  }
});

router.get("/tenants/:tenantId", authenticateJwt, requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id || null;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId is required" });

  try {
    const bundle = await getTenantDetailBundle(tenantId, { landlordId });
    if (!bundle?.tenant) return res.status(404).json({ ok: false, error: "Tenant not found" });
    return res.status(200).json({ ok: true, ...bundle });
  } catch (err: any) {
    console.error("[publicRoutes] GET /tenants/:tenantId error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenant" });
  }
});

/**
 * Messaging routes (mounted under /api via publicRoutes)
 */
router.get("/landlord/messages/conversations", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  try {
    const snap = await db.collection("conversations").where("landlordId", "==", landlordId).get();

    const items = snap.docs.map(normalizeConversation);
    items.sort((a: any, b: any) => {
      const aKey = a.lastMessageAt || a.createdAt || 0;
      const bKey = b.lastMessageAt || b.createdAt || 0;
      return (bKey as number) - (aKey as number);
    });

    const withUnread = items.map((c: any) => ({
      ...c,
      hasUnread:
        c.lastMessageAt != null &&
        (c.lastReadAtLandlord == null || c.lastMessageAt > c.lastReadAtLandlord),
    }));

    return res.json({ ok: true, conversations: withUnread });
  } catch (err: any) {
    console.error("[publicRoutes] landlord conversations error", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to list conversations",
      detail: err?.message || String(err),
    });
  }
});

router.get("/landlord/messages/conversations/:id", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msgSnap = await db.collection("messages").where("conversationId", "==", id).get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    messages.sort((a: any, b: any) => {
      const aKey = a.createdAtMs || toMillis(a.createdAt) || 0;
      const bKey = b.createdAtMs || toMillis(b.createdAt) || 0;
      return (bKey as number) - (aKey as number);
    });
    const limited = messages.slice(0, limit);
    return res.json({ ok: true, conversation: convo, conversationId: id, messages: limited });
  } catch (err: any) {
    console.error("[publicRoutes] landlord convo messages error", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load messages",
      detail: err?.message || String(err),
    });
  }
});

router.post("/landlord/messages/conversations/:id", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
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
    await notifyMessageRecipient({ convo, senderRole: "landlord", messageBody: body, requestUser: req.user });
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[publicRoutes] landlord send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/landlord/messages/conversations/:id/read", authenticateJwt, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
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
    console.error("[publicRoutes] landlord read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

router.get("/tenant/messages/conversation", authenticateJwt, requireTenant, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const ctx = await getTenantContext(req);
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const docId = ctx.unitId
    ? `${ctx.landlordId}__${ctx.tenantId}__${ctx.unitId}`
    : `${ctx.landlordId}__${ctx.tenantId}`;
  try {
    const ref = db.collection("conversations").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        landlordId: ctx.landlordId,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId || null,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
        lastMessageAt: null,
        lastReadAtLandlord: null,
        lastReadAtTenant: null,
        lastNotifiedAtLandlordMs: null,
        lastNotifiedAtTenantMs: null,
      });
      const created = await ref.get();
      return res.json({ ok: true, conversation: normalizeConversation(created) });
    }
    return res.json({ ok: true, conversation: normalizeConversation(snap) });
  } catch (err: any) {
    console.error("[publicRoutes] tenant get/create conversation error", err);
    return res.status(500).json({ ok: false, error: "Failed to load conversation" });
  }
});

router.get("/tenant/messages/conversation/:id", authenticateJwt, requireTenant, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const ctx = await getTenantContext(req);
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

    const msgSnap = await db.collection("messages").where("conversationId", "==", id).get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    messages.sort((a: any, b: any) => {
      const aKey = a.createdAtMs || toMillis(a.createdAt) || 0;
      const bKey = b.createdAtMs || toMillis(b.createdAt) || 0;
      return (bKey as number) - (aKey as number);
    });
    const limited = messages.slice(0, limit);

    return res.json({ ok: true, conversation: convo, conversationId: id, messages: limited });
  } catch (err: any) {
    console.error("[publicRoutes] tenant conversation error", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load messages",
      detail: err?.message || String(err),
    });
  }
});

router.post("/tenant/messages/conversation/:id", authenticateJwt, requireTenant, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const ctx = await getTenantContext(req);
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
    await notifyMessageRecipient({ convo, senderRole: "tenant", messageBody: body, requestUser: req.user });
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[publicRoutes] tenant send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/tenant/messages/conversation/:id/read", authenticateJwt, requireTenant, async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  const ctx = await getTenantContext(req);
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
    console.error("[publicRoutes] tenant read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

/**
 * Tenant magic link authentication (passwordless)
 */
router.post("/tenant/auth/magic-link", async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  try {
    const emailRaw = String(req.body?.email || "").trim().toLowerCase();
    const nextRaw = String(req.body?.next || "").trim();
    const next =
      nextRaw && (nextRaw.startsWith("/tenant") || nextRaw.startsWith("tenant"))
        ? nextRaw
        : null;
    if (!emailRaw || !emailRaw.includes("@")) {
      return res.json({ ok: true });
    }

    const tenantSnap = await db.collection("tenants").where("email", "==", emailRaw).limit(1).get();
    if (tenantSnap.empty) {
      return res.json({ ok: true });
    }
    const tenantDoc = tenantSnap.docs[0];
    const tenant = tenantDoc.data() as any;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    await db.collection("tenant_magic_links").doc(token).set({
      token,
      tenantId: tenantDoc.id,
      email: emailRaw,
      landlordId: tenant?.landlordId || null,
      next,
      createdAt: FieldValue.serverTimestamp(),
      expiresAtMs,
      usedAt: null,
      used: false,
    });

    const apiKey = process.env.SENDGRID_API_KEY;
    const from =
      process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
    if (apiKey && from) {
      try {
        sgMail.setApiKey(apiKey as string);
        const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
        const link = `${baseUrl}/tenant/magic?token=${encodeURIComponent(token)}${
          next ? `&next=${encodeURIComponent(next)}` : ""
        }`;
        const subject = "Your RentChain login link";
        const text =
          `Hi,\n\n` +
          `Use this secure link to sign in to your RentChain tenant portal:\n${link}\n\n` +
          `This link expires in 15 minutes and can be used once.\n\n` +
          `— RentChain`;
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 12px 0;">Your RentChain login link</h2>
            <p>Use this secure link to sign in to your tenant portal. It expires in 15 minutes.</p>
            <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Sign in</a></p>
            <p style="color:#6b7280;font-size:12px;margin-top:18px;">If the button doesn't work, copy and paste: ${link}</p>
          </div>
        `;
        await sgMail.send({
          to: emailRaw,
          from: from as string,
          subject,
          text,
          html,
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
          mailSettings: {
            footer: { enable: false },
          },
        });
      } catch (e: any) {
        console.error("[tenant magic-link] email send failed", e?.message || e);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[tenant magic-link] request error", err);
    return res.json({ ok: true });
  }
});

router.post("/tenant/auth/magic-redeem", async (req: any, res) => {
  res.setHeader("x-route-source", "publicRoutes.ts");
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "MAGIC_LINK_INVALID" });

    const ref = db.collection("tenant_magic_links").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return res.status(400).json({ ok: false, error: "MAGIC_LINK_INVALID" });
    const data = snap.data() as any;
    const now = Date.now();
    if (data.used || data.usedAt || (data.expiresAtMs && now > data.expiresAtMs)) {
      return res.status(400).json({ ok: false, error: "MAGIC_LINK_INVALID" });
    }

    const tenantId = data.tenantId;
    if (!tenantId) return res.status(400).json({ ok: false, error: "MAGIC_LINK_INVALID" });
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) return res.status(400).json({ ok: false, error: "TENANT_NOT_FOUND" });
    const tenant = tenantSnap.data() as any;

    await ref.set({ used: true, usedAt: FieldValue.serverTimestamp() }, { merge: true });

    const tenantJwt = signTenantJwt({
      sub: tenantId,
      role: "tenant",
      tenantId,
      landlordId: tenant?.landlordId || data.landlordId || null,
      email: tenant?.email || data.email || null,
      propertyId: tenant?.propertyId || null,
      unitId: tenant?.unitId || tenant?.unit || null,
      leaseId: tenant?.leaseId || null,
    });

    return res.json({ ok: true, tenantToken: tenantJwt });
  } catch (err) {
    console.error("[tenant magic-link] redeem error", err);
    return res.status(400).json({ ok: false, error: "MAGIC_LINK_INVALID" });
  }
});

export default router;
