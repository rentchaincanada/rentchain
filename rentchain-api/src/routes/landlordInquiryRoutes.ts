import { Router } from "express";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { db } from "../config/firebase";
import { getAdminEmails, isAdminEmail } from "../lib/adminEmails";
import { requireAuth } from "../middleware/requireAuth";
import { rateLimitLeads } from "../middleware/rateLimit";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
const publicRouter = Router();
const adminRouter = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const leadBuckets = new Map<string, { count: number; resetAt: number }>();

const LEAD_RATE_LIMIT_WINDOW_MS = Number(
  process.env.LEAD_INQUIRY_RATE_LIMIT_WINDOW_MS || 24 * 60 * 60 * 1000
);
const LEAD_RATE_LIMIT_MAX = Number(process.env.LEAD_INQUIRY_RATE_LIMIT_MAX || 3);

function normEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function normalizeLeadStatus(value: string | undefined | null) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "approved" || status === "invited") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "pending" || status === "new") return "pending";
  return "pending";
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

function checkLeadRateLimit(key: string) {
  const now = Date.now();
  const bucket = leadBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    leadBuckets.set(key, { count: 1, resetAt: now + LEAD_RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }
  bucket.count += 1;
  if (bucket.count > LEAD_RATE_LIMIT_MAX) {
    return { limited: true, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { limited: false };
}

async function approveLeadById(leadId: string, req: any, res: any) {
  const leadRef = db.collection("landlordLeads").doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const lead = leadSnap.data() || {};
  const status = normalizeLeadStatus(lead.status);
  const email = normEmail(String(lead.email || ""));
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  if (status === "approved") {
    return res.json({ ok: true, status: "approved", message: "already_approved", emailed: false });
  }
  if (status === "rejected") {
    return res.json({ ok: true, status: "rejected", message: "already_rejected", emailed: false });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  const userDoc = usersSnap.empty ? null : usersSnap.docs[0];
  const userId = userDoc?.id || null;

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
      status: "approved",
      approvedAt: now,
      approvedBy: req.user?.id || req.user?.email || null,
      updatedAt: now,
    },
    { merge: true }
  );

  const referralSnap = await db
    .collection("referrals")
    .where("refereeEmail", "==", email)
    .where("status", "in", ["sent", "accepted"])
    .limit(1)
    .get()
    .catch(() => null);
  if (referralSnap && !referralSnap.empty) {
    const referralDoc = referralSnap.docs[0];
    await referralDoc.ref.set(
      {
        status: "approved",
        approvedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    const referralData = referralDoc.data() || {};
    await leadRef.set(
      {
        referralId: referralDoc.id,
        referralCode: referralData.referralCode || null,
        referrerLandlordId: referralData.referrerLandlordId || null,
        referralStatus: "approved",
        priority: true,
      },
      { merge: true }
    );
  }

  console.info("[landlord-leads] approved", {
    leadId,
    email,
    approvedBy: req.user?.email || req.user?.id || null,
    ts: now,
  });

  if (userId) {
    await db.collection("users").doc(userId).set(
      {
        approved: true,
        approvedAt: now,
        approvedBy: req.user?.email || req.user?.id || null,
      },
      { merge: true }
    );
    await db.collection("accounts").doc(userId).set(
      {
        approved: true,
        approvedAt: now,
        approvedBy: req.user?.email || req.user?.id || null,
      },
      { merge: true }
    );
  }

  const baseUrl = resolveFrontendBase();
  const inviteUrl = `${baseUrl}/invite/${token}`;
  const loginUrl = `${baseUrl}/login`;

  const { apiKey, from } = getSendgridConfig();
  if (!apiKey || !from) {
    return res.json({ ok: true, inviteUrl, emailed: false, emailError: "SendGrid not configured" });
  }

  try {
    const subject = "Your RentChain landlord access is approved";
    const actionUrl = userId ? loginUrl : inviteUrl;
    const intro = userId
      ? "Your landlord access has been approved."
      : "Your landlord access has been approved. Your invite expires in 7 days.";
    await sendEmail({
      to: email,
      from: from as string,
      subject,
      text: buildEmailText({
        intro,
        ctaText: userId ? "Open RentChain" : "Accept invite",
        ctaUrl: actionUrl,
      }),
      html: buildEmailHtml({
        title: "Landlord access approved",
        intro,
        ctaText: userId ? "Open RentChain" : "Accept invite",
        ctaUrl: actionUrl,
      }),
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
}

publicRouter.post(
  "/landlord-inquiry",
  rateLimitLeads,
  async (req, res) => {
    res.setHeader("x-route-source", "landlordInquiryRoutes.ts:public");

    const email = normEmail(req.body?.email || "");
    const firstName = String(req.body?.firstName || "").trim().slice(0, 80);
    const portfolioSize = String(req.body?.portfolioSize || "").trim().slice(0, 80);
    const note = String(req.body?.note || "").trim().slice(0, 500);
    const referralCode = String(req.body?.referralCode || "").trim().toUpperCase();

    if (!email || !emailRegex.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // Rate limit returns ok:true to avoid enumeration. Do not create a lead when limited.
    const key = `lead:${req.ip}:${email || "unknown"}`;
    const rate = checkLeadRateLimit(key);
    if (rate.limited) {
      return res.json({ ok: true, rateLimited: true, message: "received" });
    }

    const id = sha256(email);
    const now = Date.now();
    let referralMeta: Record<string, any> = {};
    if (referralCode) {
      const referralSnap = await db
        .collection("referrals")
        .where("referralCode", "==", referralCode)
        .limit(1)
        .get();
      if (referralSnap.empty) {
        return res.status(400).json({ ok: false, error: "invalid_referral_code" });
      }
      const referralDoc = referralSnap.docs[0];
      const referral = referralDoc.data() || {};
      const referralEmail = normEmail(String(referral.refereeEmail || ""));
      const referralStatus = String(referral.status || "").toLowerCase();
      if (referralEmail && referralEmail !== email) {
        return res.status(400).json({ ok: false, error: "referral_email_mismatch" });
      }
      if (referralStatus === "expired") {
        return res.status(400).json({ ok: false, error: "referral_expired" });
      }
      if (referralStatus !== "approved") {
        await referralDoc.ref.set(
          {
            status: "accepted",
            acceptedAt: referral.acceptedAt || now,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      referralMeta = {
        referralId: referralDoc.id,
        referralCode,
        referrerLandlordId: referral.referrerLandlordId || null,
        referralStatus: referralStatus === "approved" ? "approved" : "accepted",
        priority: true,
      };
    }
    const leadRef = db.collection("landlordLeads").doc(id);
    const existing = await leadRef.get();
    const existingData = existing.exists ? existing.data() : null;
    const existingStatus = String(existingData?.status || "").toLowerCase();

    if (existingStatus === "invited" || existingStatus === "approved" || existingStatus === "rejected") {
      return res.json({ ok: true, status: normalizeLeadStatus(existingStatus), emailed: false });
    }

    await leadRef.set(
      {
        email,
        firstName: firstName || null,
        portfolioSize: portfolioSize || null,
        note: note || null,
        status: "pending",
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
        ...referralMeta,
      },
      { merge: true }
    );

    const { apiKey, from } = getSendgridConfig();
    if (!apiKey || !from) {
      return res.json({ ok: true, emailed: false, adminNotified: false });
    }

    const baseUrl = resolveFrontendBase();
    const leadSubject = "RentChain access request received";
    const leadPortalUrl = `${baseUrl}/site/pricing`;

    const admins = getAdminEmails();
    const adminSubject = "New RentChain access request";
    const adminReviewUrl = `${baseUrl}/admin/leads?leadId=${encodeURIComponent(id)}`;
    const adminText =
      `A new landlord lead requested access.\n\n` +
      `Email: ${email}\n` +
      `Name: ${firstName || "—"}\n` +
      `Portfolio size: ${portfolioSize || "—"}\n` +
      `Note: ${note || "—"}\n\n` +
      `Review request:\n${adminReviewUrl}\n`;

    let emailed = false;
    let adminNotified = false;
    try {
      await sendEmail({
        to: email,
        from: from as string,
        subject: leadSubject,
        text: buildEmailText({
          intro: `Thanks${firstName ? `, ${firstName}` : ""} — we received your request for RentChain access. We’ll review your request and follow up shortly.`,
          ctaText: "View RentChain",
          ctaUrl: leadPortalUrl,
        }),
        html: buildEmailHtml({
          title: "Request received",
          intro: `Thanks${firstName ? `, ${firstName}` : ""} — we received your request for RentChain access. We’ll review your request and follow up shortly.`,
          ctaText: "View RentChain",
          ctaUrl: leadPortalUrl,
        }),
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
          html: buildEmailHtml({
            title: "New access request",
            intro: `A new landlord lead requested access.\nEmail: ${email}\nName: ${firstName || "—"}\nPortfolio size: ${portfolioSize || "—"}\nNote: ${note || "—"}`,
            ctaText: "Review request",
            ctaUrl: adminReviewUrl,
            footerNote: "You received this because you are configured as a RentChain admin.",
          }),
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
  return approveLeadById(leadId, req, res);
});

adminRouter.get("/landlord-leads", requireAuth, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordInquiryRoutes.ts:admin");

  const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
  if (!isAdminEmail(requesterEmail)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const limitRaw = Number(req.query?.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const status = String(req.query?.status || "").trim().toLowerCase();
  const allowedStatus = status === "pending" || status === "approved" || status === "rejected";

  const baseQuery = db.collection("landlordLeads");
  let snap;
  if (allowedStatus) {
    if (status === "pending") {
      snap = await baseQuery.where("status", "in", ["pending", "new"]).limit(limit).get();
    } else if (status === "approved") {
      snap = await baseQuery.where("status", "in", ["approved", "invited"]).limit(limit).get();
    } else {
      snap = await baseQuery.where("status", "==", status).limit(limit).get();
    }
  } else {
    snap = await baseQuery.orderBy("createdAt", "desc").limit(limit).get();
  }

  const leads = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return { id: doc.id, ...data, status: normalizeLeadStatus(data.status) };
  });
  if (allowedStatus) {
    leads.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return res.json({ ok: true, leads });
});

adminRouter.post("/landlord-leads/:id/approve", requireAuth, async (req: any, res) => {
  res.setHeader("x-route-source", "landlordInquiryRoutes.ts:admin");

  const requesterEmail = String(req.user?.email || "").trim().toLowerCase();
  if (!isAdminEmail(requesterEmail)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const leadId = String(req.params?.id || "").trim();
  if (!leadId) {
    return res.status(400).json({ ok: false, error: "missing_id" });
  }

  return approveLeadById(leadId, req, res);
});

adminRouter.post("/landlord-leads/:id/reject", requireAuth, async (req: any, res) => {
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
  const status = normalizeLeadStatus(lead.status);
  if (status === "rejected") {
    return res.json({ ok: true, status: "rejected", message: "already_rejected" });
  }
  if (status === "approved") {
    return res.json({ ok: true, status: "approved", message: "already_approved" });
  }

  const now = Date.now();
  await leadRef.set(
    {
      status: "rejected",
      rejectedAt: now,
      rejectedBy: req.user?.id || req.user?.email || null,
      updatedAt: now,
    },
    { merge: true }
  );

  console.info("[landlord-leads] rejected", {
    leadId,
    email: lead?.email || null,
    rejectedBy: req.user?.email || req.user?.id || null,
    ts: now,
  });

  return res.json({ ok: true, status: "rejected" });
});

export { publicRouter, adminRouter };
