import { Router } from "express";
import crypto from "crypto";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { signAuthToken } from "../auth/jwt";

const router = Router();

const REDEEMABLE_PLANS = new Set(["free", "starter", "pro", "elite"]);

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizedPlan(input?: string | null): "free" | "starter" | "pro" | "elite" {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "free" || raw === "basic") return "free";
  if (raw === "pro") return "pro";
  if (raw === "elite" || raw === "business" || raw === "enterprise") return "elite";
  if (raw === "starter") return "starter";
  return "free";
}

router.post("/redeem", async (req: any, res) => {
  const code = String(req.body?.code || req.body?.token || "").trim();
  const password = String(req.body?.password || "").trim();
  const fullName = String(req.body?.fullName || "").trim();
  const emailInput = String(req.body?.email || "").trim().toLowerCase();

  if (!code) {
    return res.status(400).json({ ok: false, error: "missing_code" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ ok: false, error: "invalid_password" });
  }

  const now = Date.now();
  const codeHash = sha256(code);

  let resolvedEmail = "";
  let plan: "free" | "starter" | "pro" | "elite" = "free";
  let landlordIdFromInvite: string | null = null;
  let source: "landlord_invite" | "referral" | null = null;
  let inviteRef: FirebaseFirestore.DocumentReference | null = null;
  let referralRef: FirebaseFirestore.DocumentReference | null = null;

  const inviteSnap = await db.collection("landlordInvites").doc(codeHash).get();
  if (inviteSnap.exists) {
    const invite = inviteSnap.data() as any;
    if (invite.status === "used" || invite.usedAt) {
      return res.status(409).json({ ok: false, error: "invite_used" });
    }
    if (invite.expiresAt && now > Number(invite.expiresAt)) {
      return res.status(410).json({ ok: false, error: "invite_expired" });
    }
    resolvedEmail = String(invite.email || "").trim().toLowerCase();
    plan = normalizedPlan(invite.plan);
    source = "landlord_invite";
    inviteRef = inviteSnap.ref;
  } else {
    const referralCode = String(code || "").toUpperCase();
    const referralSnap = await db
      .collection("referrals")
      .where("referralCode", "==", referralCode)
      .limit(1)
      .get();
    if (referralSnap.empty) {
      return res.status(404).json({ ok: false, error: "invite_not_found" });
    }
    const referralDoc = referralSnap.docs[0];
    const referral = referralDoc.data() as any;
    const status = String(referral.status || "").toLowerCase();
    if (status === "expired") {
      return res.status(410).json({ ok: false, error: "invite_expired" });
    }
    if (status === "approved") {
      return res.status(409).json({ ok: false, error: "invite_used" });
    }

    resolvedEmail = String(referral.refereeEmail || emailInput || "").trim().toLowerCase();
    if (!resolvedEmail) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }
    plan = normalizedPlan(referral.plan);
    source = "referral";
    referralRef = referralDoc.ref;
    landlordIdFromInvite = String(referral.referrerLandlordId || "").trim() || null;
  }

  if (!resolvedEmail) {
    return res.status(400).json({ ok: false, error: "invite_invalid" });
  }
  if (emailInput && emailInput !== resolvedEmail) {
    return res.status(400).json({ ok: false, error: "email_mismatch" });
  }

  let userRecord: admin.auth.UserRecord | null = null;
  try {
    userRecord = await admin.auth().getUserByEmail(resolvedEmail);
    await admin.auth().updateUser(userRecord.uid, {
      password,
      displayName: fullName || userRecord.displayName || undefined,
      emailVerified: true,
      disabled: false,
    });
  } catch (err: any) {
    if (String(err?.code || "") !== "auth/user-not-found") {
      console.error("[invites/redeem] get/update user failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "user_update_failed" });
    }
    try {
      userRecord = await admin.auth().createUser({
        email: resolvedEmail,
        password,
        emailVerified: true,
        disabled: false,
        displayName: fullName || undefined,
      });
    } catch (createErr: any) {
      console.error("[invites/redeem] create user failed", createErr?.message || createErr);
      return res.status(500).json({ ok: false, error: "create_user_failed" });
    }
  }

  const uid = userRecord.uid;
  if (!REDEEMABLE_PLANS.has(plan)) {
    plan = "free";
  }

  await db.collection("users").doc(uid).set(
    {
      id: uid,
      email: resolvedEmail,
      role: "landlord",
      landlordId: uid,
      status: "active",
      approved: true,
      approvedAt: now,
      approvedBy: source,
      plan,
      invitedByLandlordId: landlordIdFromInvite,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.collection("accounts").doc(uid).set(
    {
      id: uid,
      email: resolvedEmail,
      role: "landlord",
      landlordId: uid,
      status: "active",
      approved: true,
      approvedAt: now,
      approvedBy: source,
      plan,
      invitedByLandlordId: landlordIdFromInvite,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.collection("landlords").doc(uid).set(
    {
      id: uid,
      email: resolvedEmail,
      role: "landlord",
      landlordId: uid,
      approved: true,
      approvedAt: now,
      approvedBy: source,
      plan,
      invitedByLandlordId: landlordIdFromInvite,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  if (inviteRef) {
    await inviteRef.set(
      {
        status: "used",
        usedAt: now,
        usedByUserId: uid,
      },
      { merge: true }
    );
  }
  if (referralRef) {
    await referralRef.set(
      {
        status: "approved",
        approvedAt: now,
        acceptedAt: now,
        acceptedByUserId: uid,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  const token = signAuthToken({
    sub: uid,
    email: resolvedEmail,
    role: "landlord",
    landlordId: uid,
    permissions: [],
    revokedPermissions: [],
  });

  return res.status(200).json({
    ok: true,
    token,
    user: {
      id: uid,
      email: resolvedEmail,
      role: "landlord",
      landlordId: uid,
      approved: true,
      plan,
    },
  });
});

export default router;
