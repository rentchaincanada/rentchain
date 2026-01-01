import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../config/firebase";

const router = Router();

function signTenantJwt(payload: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "14d" });
}

router.get("/tenant/invites/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "Bad request" });

  const snap = await db.collection("tenantInvites").doc(token).get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });

  const inv: any = snap.data();
  const now = Date.now();

  if (inv.expiresAt && now > Number(inv.expiresAt)) {
    return res.status(410).json({ ok: false, error: "Invite expired" });
  }
  if (inv.status && String(inv.status) !== "pending") {
    return res.status(409).json({ ok: false, error: "Invite not available" });
  }

  res.setHeader("x-route-source", "tenantInviteAliasesRoutes");
  return res.json({
    ok: true,
    token,
    email: inv.tenantEmail || inv.email || null,
    fullName: inv.tenantName || inv.fullName || null,
    propertyId: inv.propertyId || null,
    unitId: inv.unitId || null,
  });
});

router.post("/tenant/invites/:token/accept", async (req: any, res: any) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "Bad request" });

  const ref = db.collection("tenantInvites").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });

  const inv: any = snap.data();
  const now = Date.now();

  if (inv.expiresAt && now > Number(inv.expiresAt)) {
    return res.status(410).json({ ok: false, error: "Invite expired" });
  }
  if (inv.status && String(inv.status) !== "pending") {
    return res.status(409).json({ ok: false, error: "Invite not available" });
  }

  const email = String(inv.tenantEmail || inv.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "Invite invalid" });

  const tenantId = crypto
    .createHash("sha256")
    .update(`${inv.landlordId}:${email}`.toLowerCase())
    .digest("hex")
    .slice(0, 24);

  await db
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        id: tenantId,
        tenantId,
        landlordId: inv.landlordId,
        email,
        fullName: inv.tenantName || inv.fullName || null,
        propertyId: inv.propertyId || null,
        unitId: inv.unitId || null,
        leaseId: inv.leaseId || null,
        createdAt: now,
        source: "invite",
      },
      { merge: true }
    );

  await ref.set(
    {
      status: "redeemed",
      redeemedAt: now,
      tenantId,
      updatedAt: now,
    },
    { merge: true }
  );

  const tenantJwt = signTenantJwt({
    sub: tenantId,
    role: "tenant",
    tenantId,
    landlordId: inv.landlordId,
    email,
    propertyId: inv.propertyId || null,
    unitId: inv.unitId || null,
    leaseId: inv.leaseId || null,
  });

  res.setHeader("x-route-source", "tenantInviteAliasesRoutes");
  return res.json({
    ok: true,
    tenantToken: tenantJwt,
    tenant: {
      id: tenantId,
      email,
      propertyId: inv.propertyId || null,
      unitId: inv.unitId || null,
      leaseId: inv.leaseId || null,
    },
  });
});

export default router;
