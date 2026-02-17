import { Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import { getAdminEmails } from "../lib/adminEmails";
import { sendEmail } from "../services/emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

const router = Router();

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

router.post("/request", async (req: any, res) => {
  res.setHeader("x-route-source", "accessRoutes.ts");
  const email = normEmail(req.body?.email || "");
  const firstName = String(req.body?.firstName || "").trim().slice(0, 80);
  const portfolioSize = String(req.body?.portfolioSize || "").trim().slice(0, 80);
  const note = String(req.body?.note || "").trim().slice(0, 500);

  if (!email || !emailRegex.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const now = Date.now();
  const leadId = sha256(email);
  await db.collection("landlordLeads").doc(leadId).set(
    {
      email,
      firstName: firstName || null,
      portfolioSize: portfolioSize || null,
      note: note || null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  const admins = getAdminEmails();
  let emailed = false;
  let adminNotified = false;

  if (from) {
    try {
      const baseUrl = resolveFrontendBase();
      await sendEmail({
        to: email,
        from: from as string,
        subject: "RentChain access request received",
        text: buildEmailText({
          intro: `Thanks${firstName ? `, ${firstName}` : ""} - we received your request for RentChain access.`,
          ctaText: "View RentChain",
          ctaUrl: `${baseUrl}/site/pricing`,
        }),
        html: buildEmailHtml({
          title: "Request received",
          intro: `Thanks${firstName ? `, ${firstName}` : ""} - we received your request for RentChain access.`,
          ctaText: "View RentChain",
          ctaUrl: `${baseUrl}/site/pricing`,
        }),
      });
      emailed = true;
    } catch {
      emailed = false;
    }

    if (admins.length > 0) {
      try {
        await sendEmail({
          to: admins,
          from: from as string,
          subject: "New RentChain access request",
          text:
            `New landlord lead:\n\n` +
            `Email: ${email}\n` +
            `Name: ${firstName || "-"}\n` +
            `Portfolio: ${portfolioSize || "-"}\n` +
            `Note: ${note || "-"}\n`,
          html: buildEmailHtml({
            title: "New access request",
            intro: `Email: ${email}\nName: ${firstName || "-"}\nPortfolio: ${portfolioSize || "-"}\nNote: ${note || "-"}`,
            ctaText: "Review leads",
            ctaUrl: `${resolveFrontendBase()}/admin/leads`,
          }),
        });
        adminNotified = true;
      } catch {
        adminNotified = false;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    status: "pending",
    emailed,
    adminNotified,
  });
});

export default router;
