import { Router } from "express";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { db } from "../config/firebase";
import { isAdminEmail } from "../lib/adminEmails";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  const base = String(process.env.FRONTEND_URL || fallback).trim();
  return base.replace(/\/$/, "");
}

function formatExpiry(expiresAtMs: number) {
  try {
    return new Date(expiresAtMs).toLocaleString();
  } catch {
    return new Date(expiresAtMs).toISOString();
  }
}

router.post("/landlord-invites", requireAuth, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordInvitesAdminRoutes.ts");

  const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
  if (!isAdminEmail(requesterEmail)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  await db.collection("landlordInvites").doc(tokenHash).set(
    {
      tokenHash,
      email,
      createdAt: now,
      expiresAt,
      createdBy: req.user?.id || req.user?.landlordId || null,
      usedAt: null,
      usedByUserId: null,
      status: "sent",
    },
    { merge: true }
  );

  const baseUrl = resolveFrontendBase();
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const apiKey = process.env.SENDGRID_API_KEY;
  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  if (!apiKey || !from) {
    return res.json({
      ok: true,
      inviteUrl,
      expiresAt,
      emailed: false,
      emailError: "SendGrid not configured",
    });
  }

  try {
    sgMail.setApiKey(apiKey as string);
    const subject = "You’re invited to RentChain";
    const text =
      `You're invited to RentChain.\n\n` +
      `Open this link to accept your invite:\n${inviteUrl}\n\n` +
      `This invite expires: ${formatExpiry(expiresAt)}\n\n` +
      `— RentChain`;

    await sgMail.send({
      to: email,
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

    return res.json({ ok: true, inviteUrl, expiresAt, emailed: true });
  } catch (err: any) {
    console.error("[landlord-invites] email send failed", err?.message || err);
    return res.json({
      ok: true,
      inviteUrl,
      expiresAt,
      emailed: false,
      emailError: String(err?.message || err),
    });
  }
});

export default router;
