import { Router } from "express";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { db } from "../config/firebase";
import { getAdminEmails, isAdminEmail } from "../lib/adminEmails";
import { requireAuth } from "../middleware/requireAuth";
import { rateLimit } from "../middleware/rateLimit";

const publicRouter = Router();
const adminRouter = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

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

function getSendgridConfig() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  return { apiKey, from };
}

async function sendEmail(message: sgMail.MailDataRequired) {
  const { apiKey } = getSendgridConfig();
  if (!apiKey) throw new Error("SENDGRID_API_KEY missing");
  sgMail.setApiKey(apiKey as string);
  await sgMail.send({
    ...message,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
    mailSettings: {
      footer: { enable: false },
    },
  });
}

publicRouter.post(
  "/landlord-inquiry",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    key: (req) => {
      const email = normEmail(String((req as any)?.body?.email || ""));
      return `lead:${req.ip}:${email || "unknown"}`;
    },
  }),
  async (req, res) => {
    res.setHeader("x-route-source", "landlordInquiryRoutes.ts:public");

    const email = normEmail(req.body?.email || "");
    const firstName = String(req.body?.firstName || "").trim().slice(0, 80);
    const portfolioSize = String(req.body?.portfolioSize || "").trim().slice(0, 80);
    const note = String(req.body?.note || "").trim().slice(0, 500);

    if (!email || !emailRegex.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const id = sha256(email);
    const now = Date.now();
    const leadRef = db.collection("landlordLeads").doc(id);
    const existing = await leadRef.get();
    const existingData = existing.exists ? existing.data() : null;
    const existingStatus = String(existingData?.status || "").toLowerCase();

    if (existingStatus === "invited" || existingStatus === "rejected") {
      return res.json({ ok: true, status: existingStatus, emailed: false });
    }

    await leadRef.set(
      {
        email,
        firstName: firstName || null,
        portfolioSize: portfolioSize || null,
        note: note || null,
        status: "new",
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
      },
      { merge: true }
    );

    const { apiKey, from } = getSendgridConfig();
    if (!apiKey || !from) {
      return res.json({ ok: true, emailed: false, adminNotified: false });
    }

    const baseUrl = resolveFrontendBase();
    const leadSubject = "RentChain access request received";
    const leadText =
      `Thanks${firstName ? `, ${firstName}` : ""} — we received your request for RentChain access.\n\n` +
      `We’ll review your request and follow up shortly.\n\n` +
      `— RentChain`;

    const admins = getAdminEmails();
    const adminSubject = "New RentChain access request";
    const adminText =
      `A new landlord lead requested access.\n\n` +
      `Email: ${email}\n` +
      `Name: ${firstName || "—"}\n` +
      `Portfolio size: ${portfolioSize || "—"}\n` +
      `Note: ${note || "—"}\n\n` +
      `Approve in admin or use /api/admin/landlord-inquiry/${id}/approve.\n` +
      `Landing: ${baseUrl}/invite (admin invite flow)\n`;

    let emailed = false;
    let adminNotified = false;
    try {
      await sendEmail({
        to: email,
        from: from as string,
        subject: leadSubject,
        text: leadText,
      });
      emailed = true;
    } catch (err: any) {
      console.error("[landlord-inquiry] lead email failed", err?.message || err);
    }

    try {
      if (admins.length) {
        await sendEmail({
          to: admins,
          from: from as string,
          subject: adminSubject,
          text: adminText,
        });
        adminNotified = true;
      }
    } catch (err: any) {
      console.error("[landlord-inquiry] admin email failed", err?.message || err);
    }

    return res.json({ ok: true, emailed, adminNotified });
  }
);

adminRouter.post("/landlord-inquiry/:id/approve", requireAuth, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordInquiryRoutes.ts:admin");

  const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
  if (!isAdminEmail(requesterEmail)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const leadId = String(req.params?.id || "").trim();
  if (!leadId) {
    return res.status(400).json({ ok: false, error: "missing_id" });
  }

  const leadRef = db.collection("landlordLeads").doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const lead = leadSnap.data() || {};
  const email = normEmail(String(lead.email || ""));
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  if (String(lead.status || "").toLowerCase() === "invited") {
    return res.json({ ok: true, status: "invited", emailed: false });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  const inviteRef = db.collection("landlordInvites").doc(tokenHash);
  await inviteRef.set(
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

  await leadRef.set(
    {
      status: "invited",
      invitedAt: now,
      invitedBy: req.user?.id || req.user?.email || null,
      updatedAt: now,
    },
    { merge: true }
  );

  const baseUrl = resolveFrontendBase();
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const { apiKey, from } = getSendgridConfig();
  if (!apiKey || !from) {
    return res.json({ ok: true, inviteUrl, emailed: false, emailError: "SendGrid not configured" });
  }

  try {
    await sendEmail({
      to: email,
      from: from as string,
      subject: "You’re invited to RentChain",
      text:
        `You're invited to RentChain.\n\n` +
        `Open this link to accept your invite:\n${inviteUrl}\n\n` +
        `This invite expires in 7 days.\n\n` +
        `— RentChain`,
    });
    return res.json({ ok: true, inviteUrl, emailed: true });
  } catch (err: any) {
    console.error("[landlord-inquiry] invite email failed", err?.message || err);
    return res.json({
      ok: true,
      inviteUrl,
      emailed: false,
      emailError: String(err?.message || err),
    });
  }
});

export { publicRouter, adminRouter };
