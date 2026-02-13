import { Router } from "express";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { rateLimitReferralsUser } from "../middleware/rateLimit";

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_REFERRAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function normEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  return String(process.env.FRONTEND_URL || fallback).trim().replace(/\/$/, "");
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
  });
}

async function createReferralCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = `RCREF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const snap = await db
      .collection("referrals")
      .where("referralCode", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  throw new Error("referral_code_generation_failed");
}

router.get("/referrals", requireAuth, async (req: any, res) => {
  res.setHeader("x-route-source", "referralsRoutes.ts");
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN", detail: "role_not_landlord" });
    }
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    if (!landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN", detail: "missing_landlordId" });
    }

    // Avoid composite index dependency: fetch by landlordId then sort in memory.
    const snap = await db
      .collection("referrals")
      .where("referrerLandlordId", "==", landlordId)
      .limit(200)
      .get();

    const referrals = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return res.json({ ok: true, referrals });
  } catch (err: any) {
    console.error("[referrals] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "REFERRALS_LIST_FAILED" });
  }
});

router.post("/referrals", requireAuth, rateLimitReferralsUser, async (req: any, res) => {
  res.setHeader("x-route-source", "referralsRoutes.ts");
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN", detail: "role_not_landlord" });
    }
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    if (!landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN", detail: "missing_landlordId" });
    }

    const refereeEmail = normEmail(req.body?.refereeEmail || "");
    const refereeName = String(req.body?.refereeName || "").trim().slice(0, 120) || null;
    const note = String(req.body?.note || "").trim().slice(0, 500) || null;
    if (!refereeEmail || !emailRegex.test(refereeEmail)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const now = Date.now();
    // Avoid composite index dependency: fetch recent refs by email, filter in memory.
    const existingSnap = await db
      .collection("referrals")
      .where("refereeEmail", "==", refereeEmail)
      .limit(20)
      .get();
    const existingDoc = existingSnap.docs.find((doc) => {
      const data = doc.data() as any;
      const createdAt = Number(data?.createdAt || 0);
      const status = String(data?.status || "").toLowerCase();
      return createdAt >= now - ACTIVE_REFERRAL_WINDOW_MS && status !== "expired";
    });
    if (existingDoc) {
      const data = existingDoc.data() as any;
      return res.json({
        ok: true,
        referral: {
          id: existingDoc.id,
          referralCode: data.referralCode,
          status: data.status,
        },
        deduped: true,
        emailed: false,
      });
    }

    const referralCode = await createReferralCode();
    const referrerEmail = normEmail(req.user?.email || "");
    const referrerName = String(req.user?.name || req.user?.displayName || "").trim() || null;

    const referralRef = db.collection("referrals").doc();
    await referralRef.set({
      referrerLandlordId: landlordId,
      referrerEmail: referrerEmail || null,
      referrerName,
      refereeEmail,
      refereeName,
      note,
      status: "sent",
      referralCode,
      createdAt: now,
      updatedAt: now,
      acceptedAt: null,
      approvedAt: null,
      lastEmailSentAt: null,
      metadata: {
        userAgent: req.get("user-agent") || null,
      },
    });

    const link = `${resolveFrontendBase()}/site/request-access?ref=${encodeURIComponent(referralCode)}`;
    const { apiKey, from } = getSendgridConfig();
    let emailed = false;
    if (apiKey && from) {
      try {
        await sendEmail({
          to: refereeEmail,
          from: from as string,
          subject: "You've been invited to RentChain",
          text:
            `${referrerName || "A RentChain landlord"} invited you to RentChain.\n\n` +
            `Request access here:\n${link}\n\n` +
            "Verified screening, clear records, trusted rental relationships.",
        });
        emailed = true;
        await referralRef.set({ lastEmailSentAt: Date.now() }, { merge: true });
      } catch (err: any) {
        console.error("[referrals] invite email failed", err?.message || err);
      }
    }

    return res.json({
      ok: true,
      referral: {
        id: referralRef.id,
        referralCode,
        status: "sent",
        link,
      },
      emailed,
    });
  } catch (err: any) {
    console.error("[referrals] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "REFERRAL_CREATE_FAILED" });
  }
  });

export default router;
