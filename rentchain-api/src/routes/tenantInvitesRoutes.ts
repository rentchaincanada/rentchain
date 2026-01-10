import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../config/firebase";
import sgMail from "@sendgrid/mail";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = Router();

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "14d" });
}

router.post(
  "/",
  requireAuth,
  requirePermission("users.invite"),
  async (req: any, res) => {
    res.setHeader("x-route-source", "tenantInvitesRoutes");
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const { tenantEmail, tenantName, propertyId, unitId, leaseId } = req.body || {};

    if (!tenantEmail || !String(tenantEmail).includes("@")) {
      return res.status(400).json({ ok: false, error: "tenantEmail_required" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const expiresAt = now + 1000 * 60 * 60 * 24 * 7;

    await db.collection("tenantInvites").doc(token).set({
      token,
      landlordId,
      tenantEmail,
      tenantName: tenantName || null,
      propertyId: propertyId || null,
      unitId: unitId || null,
      leaseId: leaseId || null,
      status: "pending",
      createdAt: now,
      expiresAt,
    });

    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const inviteUrl = `${baseUrl}/tenant/invite/${token}`;

    // Send email invite if SendGrid is configured
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;
    if (!apiKey || !from) {
      console.error("[tenantInvitesRoutes] sendgrid not configured", {
        hasKey: !!apiKey,
        hasFrom: !!from,
      });
      return res
        .status(502)
        .json({ ok: false, error: "INVITE_EMAIL_SEND_FAILED", detail: "SendGrid not configured" });
    }

    try {
      sgMail.setApiKey(apiKey as string);
      const subject = "You're invited to RentChain";
      const landlordEmail = req.user?.email ? String(req.user.email) : "A landlord";
      const greet = tenantName ? `Hi ${tenantName},` : "Hi,";
      const text =
        `${greet}\n\n` +
        `${landlordEmail} has invited you to join RentChain as a tenant.\n\n` +
        `Open this link to accept your invite:\n${inviteUrl}\n\n` +
        `Note: this link may expire. If you weren't expecting this, you can ignore this email.\n\n` +
        `— RentChain`;

      await sgMail.send({
        to: tenantEmail,
        from: from as string,
        subject,
        text,
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
        },
        mailSettings: {
          footer: { enable: false },
        },
      });
    } catch (e: any) {
      console.error("[tenantInvitesRoutes] send invite email failed", {
        message: e?.message,
        code: e?.code || e?.response?.statusCode,
        body: e?.response?.body,
        stack: e?.stack,
      });
      return res
        .status(502)
        .json({ ok: false, error: "INVITE_EMAIL_SEND_FAILED", detail: String(e?.message || e) });
    }

    return res.json({
      ok: true,
      token,
      inviteUrl,
      expiresAt,
      invite: {
        token,
        inviteUrl,
        status: "pending",
        propertyId: propertyId || null,
        tenantEmail,
        tenantName: tenantName || null,
        createdAt: now,
      },
      emailed: true,
    });
  }
);

router.get(
  "/",
  requireAuth,
  requirePermission("users.invite"),
  async (req: any, res) => {
    res.setHeader("x-route-source", "tenantInvitesRoutes:getList");

    try {
      const landlordId = req.user?.landlordId || req.user?.id;
      if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const limitRaw = Number(req.query?.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

      const snap = await db
        .collection("tenantInvites")
        .where("landlordId", "==", landlordId)
        .limit(limit)
        .get();

      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      const toMillis = (v: any) =>
        v?.toMillis?.() ?? (typeof v === "number" ? v : Date.parse(v ?? "")) ?? 0;

      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      return res.json({ ok: true, invites: items });
    } catch (err: any) {
      console.error("[tenantInvitesRoutes:getList] error", err?.message || err, err);
      return res.status(500).json({ ok: false, error: "Failed to load invites" });
    }
  }
);

router.post("/redeem", async (req: any, res) => {
  res.setHeader("x-route-source", "tenantInvitesRoutes");
  const token = String(req.body?.token || req.body?.inviteId || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "token_required" });

  const ref = db.collection("tenantInvites").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "invite_not_found" });

  const invite = snap.data() as any;
  if (invite.status !== "pending") {
    return res.status(400).json({ ok: false, error: "invite_already_used" });
  }
  if (Date.now() > invite.expiresAt) {
    return res.status(400).json({ ok: false, error: "invite_expired" });
  }

  const tenantId = crypto
    .createHash("sha256")
    .update(`${invite.landlordId}:${invite.tenantEmail}`.toLowerCase())
    .digest("hex")
    .slice(0, 24);

  await db
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        id: tenantId,
        landlordId: invite.landlordId,
        email: invite.tenantEmail,
        fullName: invite.tenantName || null,
        propertyId: invite.propertyId || null,
        unitId: invite.unitId || null,
        leaseId: invite.leaseId || null,
        createdAt: Date.now(),
        source: "invite",
      },
      { merge: true }
    );

  await ref.set(
    {
      status: "redeemed",
      redeemedAt: Date.now(),
      tenantId,
    },
    { merge: true }
  );

  const tenantJwt = signTenantJwt({
    sub: tenantId,
    role: "tenant",
    tenantId,
    landlordId: invite.landlordId,
    email: invite.tenantEmail,
    propertyId: invite.propertyId || null,
    unitId: invite.unitId || null,
    leaseId: invite.leaseId || null,
  });

  return res.json({
    ok: true,
    tenantToken: tenantJwt,
    tenant: {
      id: tenantId,
      email: invite.tenantEmail,
      propertyId: invite.propertyId || null,
      unitId: invite.unitId || null,
      leaseId: invite.leaseId || null,
    },
  });
});

export default router;
