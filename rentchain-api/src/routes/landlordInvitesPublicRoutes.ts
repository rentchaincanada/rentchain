import { Router } from "express";
import crypto from "crypto";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { sendEmail } from "../services/emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

const router = Router();

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nowMs() {
  return Date.now();
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  const base = String(process.env.FRONTEND_URL || fallback).trim();
  return base.replace(/\/$/, "");
}

async function sendVerificationEmail(email: string) {
  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  if (!from) {
    return { ok: false, error: "SendGrid not configured" };
  }

  const verifyUrl = await admin.auth().generateEmailVerificationLink(email, {
    url: `${resolveFrontendBase()}/login?verified=1`,
  });

  await sendEmail({
    to: email,
    from: from as string,
    subject: "Verify your RentChain email",
    text: buildEmailText({
      intro: "Welcome to RentChain. Verify your email to activate your account.",
      ctaText: "Verify email",
      ctaUrl: verifyUrl,
    }),
    html: buildEmailHtml({
      title: "Verify your RentChain email",
      intro: "Welcome to RentChain. Verify your email to activate your account.",
      ctaText: "Verify email",
      ctaUrl: verifyUrl,
    }),
  });

  return { ok: true };
}

router.get("/landlord-invites/:token", async (req, res) => {
  res.setHeader("x-route-source", "landlordInvitesPublicRoutes.ts");
  const token = String(req.params?.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "invalid_token" });

  const tokenHash = sha256(token);
  const ref = db.collection("landlordInvites").doc(tokenHash);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "invite_not_found" });

  const invite = snap.data() as any;
  if (invite.status === "used" || invite.usedAt) {
    return res.status(409).json({ ok: false, error: "invite_used" });
  }
  if (invite.expiresAt && nowMs() > Number(invite.expiresAt)) {
    return res.status(410).json({ ok: false, error: "invite_expired" });
  }

  return res.json({
    ok: true,
    email: invite.email,
    expiresAt: invite.expiresAt || null,
  });
});

router.post("/landlord-invites/:token/accept", async (req: any, res) => {
  res.setHeader("x-route-source", "landlordInvitesPublicRoutes.ts");
  const token = String(req.params?.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "invalid_token" });

  const password = String(req.body?.password || "").trim();
  const fullName = String(req.body?.fullName || "").trim();
  if (!password || password.length < 6) {
    return res.status(400).json({ ok: false, error: "invalid_password" });
  }

  const tokenHash = sha256(token);
  const ref = db.collection("landlordInvites").doc(tokenHash);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "invite_not_found" });

  const invite = snap.data() as any;
  if (invite.status === "used" || invite.usedAt) {
    return res.status(409).json({ ok: false, error: "invite_used" });
  }
  if (invite.expiresAt && nowMs() > Number(invite.expiresAt)) {
    return res.status(410).json({ ok: false, error: "invite_expired" });
  }

  const email = String(invite.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "invite_invalid" });

  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
      displayName: fullName || undefined,
    });
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "auth/email-already-exists") {
      return res.status(409).json({ ok: false, error: "email_already_exists" });
    }
    console.error("[landlord-invites] create user failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "create_user_failed" });
  }

  const uid = user.uid;
  const createdAt = admin.firestore.FieldValue.serverTimestamp();
  const now = nowMs();

  let approved = true;
  let approvedAt: number | null = now;
  let approvedBy: string | null = "invite";
  try {
    const leadSnap = await db.collection("landlordLeads").where("email", "==", email).limit(1).get();
    if (!leadSnap.empty) {
      const lead = leadSnap.docs[0].data() as any;
      const status = String(lead?.status || "").toLowerCase();
      if (status === "pending" || status === "new") {
        approved = false;
        approvedAt = null;
        approvedBy = null;
      }
      if (status === "rejected") {
        approved = false;
        approvedAt = null;
        approvedBy = null;
      }
    }
  } catch {
    // ignore lead lookup errors; default to approved
  }

  await db.collection("users").doc(uid).set(
    {
      id: uid,
      email,
      role: "landlord",
      landlordId: uid,
      status: "active",
      approved,
      approvedAt,
      approvedBy,
      createdAt,
    },
    { merge: true }
  );

  await db.collection("accounts").doc(uid).set(
    {
      id: uid,
      email,
      role: "landlord",
      landlordId: uid,
      status: "active",
      plan: "free",
      approved,
      approvedAt,
      approvedBy,
      createdAt,
    },
    { merge: true }
  );

  await db.collection("landlords").doc(uid).set(
    {
      id: uid,
      plan: "free",
      createdAt,
    },
    { merge: true }
  );

  await db
    .collection("landlords")
    .doc(uid)
    .collection("settings")
    .doc("onboarding")
    .set(
      {
        dismissed: false,
        steps: {
          propertyAdded: false,
          unitAdded: false,
          tenantInvited: false,
          applicationCreated: false,
          exportPreviewed: false,
        },
        lastSeenAt: null,
        createdAt,
      },
      { merge: true }
    );

  await ref.set(
    {
      status: "used",
      usedAt: nowMs(),
      usedByUserId: uid,
    },
    { merge: true }
  );

  let verificationSent = false;
  let verificationError: string | null = null;
  try {
    const resp = await sendVerificationEmail(email);
    verificationSent = resp.ok;
    verificationError = resp.ok ? null : resp.error || null;
  } catch (err: any) {
    verificationSent = false;
    verificationError = String(err?.message || err);
  }

  return res.json({
    ok: true,
    uid,
    email,
    verificationSent,
    verificationError,
    next: "verify_email",
  });
});

router.post("/landlord-invites/:token/resend-verification", async (req, res) => {
  res.setHeader("x-route-source", "landlordInvitesPublicRoutes.ts");
  const token = String(req.params?.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "invalid_token" });

  const tokenHash = sha256(token);
  const ref = db.collection("landlordInvites").doc(tokenHash);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "invite_not_found" });

  const invite = snap.data() as any;
  const email = String(invite.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "invite_invalid" });

  try {
    const user = await admin.auth().getUserByEmail(email);
    if (user.emailVerified) {
      return res.json({ ok: true, alreadyVerified: true });
    }
  } catch (err: any) {
    return res.status(404).json({ ok: false, error: "user_not_found" });
  }

  try {
    const resp = await sendVerificationEmail(email);
    if (!resp.ok) {
      return res.status(500).json({ ok: false, error: resp.error || "email_send_failed" });
    }
    return res.json({ ok: true, emailed: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
