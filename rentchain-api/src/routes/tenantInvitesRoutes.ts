import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";

const router = Router();

function requireLandlord(req: any, res: any, next: any) {
  if (!req.user || (req.user.role !== "landlord" && req.user.role !== "admin")) {
    return res.status(403).json({ ok: false, error: "LANDLORD_ONLY" });
  }
  return next();
}

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "14d" });
}

router.post("/", authenticateJwt, requireLandlord, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const { tenantEmail, tenantName, propertyId, unitId, leaseId } = req.body || {};

  if (!tenantEmail) {
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

  return res.json({ ok: true, token, inviteUrl, expiresAt });
});

router.post("/redeem", async (req: any, res) => {
  const { token } = req.body || {};
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
