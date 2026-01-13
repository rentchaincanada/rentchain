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
    try {
      res.setHeader("x-route-source", "tenantInvitesRoutes");
      let body: any = req.body;
      if (typeof req.body === "string") {
        try {
          body = JSON.parse(req.body);
        } catch {
          body = {};
        }
      }
      const landlordId = req.user?.landlordId || req.user?.id;
      if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
      const { tenantEmail, tenantName, propertyId, unitId, leaseId } = body || {};

      if (!tenantEmail || !String(tenantEmail).includes("@")) {
        return res.status(400).json({ ok: false, error: "tenantEmail_required" });
      }
      const toEmail = String(tenantEmail || "").trim().toLowerCase();

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

      const apiKey = process.env.SENDGRID_API_KEY;
      const from =
        process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
      if (!apiKey) return res.status(502).json({ ok: false, error: "SENDGRID_API_KEY_MISSING" });
      if (!from) return res.status(502).json({ ok: false, error: "SENDGRID_FROM_EMAIL_MISSING" });

      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`SEND_TIMEOUT_${ms}MS`)), ms)),
        ]);

      let emailed = false;
      let emailError: string | null = null;
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

        await withTimeout(
          sgMail.send({
            to: toEmail,
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
          }),
          8000
        );
        emailed = true;
      } catch (e: any) {
        emailed = false;
        emailError = String(e?.message || e);
        console.error("[tenant-invites] email send failed", { message: e?.message, stack: e?.stack });
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
        emailed,
        emailError,
      });
    } catch (err: any) {
      console.error("[tenant-invites] POST crashed", { message: err?.message, stack: err?.stack });
      return res
        .status(502)
        .json({ ok: false, error: "INVITE_CREATE_FAILED", detail: String(err?.message || err) });
    }
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
  if (Date.now() > invite.expiresAt) {
    return res.status(400).json({ ok: false, error: "invite_expired" });
  }

  const alreadyRedeemed = invite.status === "redeemed";

  const tenantId =
    invite.tenantId ||
    crypto
      .createHash("sha256")
      .update(`${invite.landlordId}:${invite.tenantEmail}`.toLowerCase())
      .digest("hex")
      .slice(0, 24);

  // Resolve property/unit/lease from existing tenant record if invite lacks them
  let resolvedPropertyId = invite.propertyId || null;
  let resolvedUnitId = invite.unitId || null;
  let resolvedLeaseId = invite.leaseId || null;
  try {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (tenantSnap.exists) {
      const t = tenantSnap.data() as any;
      resolvedPropertyId = resolvedPropertyId || t?.propertyId || null;
      resolvedUnitId = resolvedUnitId || t?.unitId || t?.unit || null;
      resolvedLeaseId = resolvedLeaseId || t?.leaseId || null;
    }
  } catch (err) {
    console.warn("[tenant-invites] resolve tenant doc failed", err);
  }

  const now = Date.now();
  await db
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        id: tenantId,
        landlordId: invite.landlordId,
        email: invite.tenantEmail,
        fullName: invite.tenantName || null,
        propertyId: resolvedPropertyId || null,
        unitId: resolvedUnitId || null,
        leaseId: resolvedLeaseId || null,
        status: "active",
        createdAt: invite.tenantId ? invite.createdAt || now : now,
        updatedAt: now,
        source: "invite",
      },
      { merge: true }
    );

  await ref.set(
    {
      status: "redeemed",
      redeemedAt: invite.redeemedAt || Date.now(),
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
    propertyId: resolvedPropertyId,
    unitId: resolvedUnitId,
    leaseId: resolvedLeaseId,
  });

  return res.json({
    ok: true,
    tenantToken: tenantJwt,
    tenant: {
      id: tenantId,
      email: invite.tenantEmail,
      propertyId: resolvedPropertyId,
      unitId: resolvedUnitId,
      leaseId: resolvedLeaseId,
      landlordId: invite.landlordId,
    },
    alreadyRedeemed,
  });
});

export default router;
