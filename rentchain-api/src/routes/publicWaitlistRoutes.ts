import { Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import { incrementCounter } from "../services/telemetryService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

router.post("/waitlist", async (req, res) => {
  try {
    const emailRaw = String(req.body?.email ?? "");
    const nameRaw = String(req.body?.name ?? "");
    const sourceRaw = String(req.body?.source ?? "website");
    const email = normEmail(emailRaw);

    if (!email || !email.includes("@") || email.length > 254) {
      return res.status(400).json({ ok: false, error: "Invalid email", emailed: false });
    }

    const maskEmail = (e: string) => {
      const parts = e.split("@");
      if (parts.length !== 2) return "***";
      const [user, domain] = parts;
      const maskedUser = user.length <= 1 ? "*" : `${user[0]}***`;
      return `${maskedUser}@${domain}`;
    };

    const id = sha256(email);
    const now = Date.now();

    await db.collection("waitlist").doc(id).set(
      {
        email,
        name: nameRaw?.slice(0, 80) || null,
        source: sourceRaw?.slice(0, 80) || "website",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM;
    const hasKey = !!apiKey;
    const hasFrom = !!from;
    if (!hasKey || !hasFrom) {
      console.error("[waitlist] sendgrid not configured", { hasKey, hasFrom });
      return res
        .status(500)
        .json({ ok: false, error: "WAITLIST_EMAIL_NOT_CONFIGURED", emailed: false });
    }

    let emailed = false;

    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const ctaLink = `${baseUrl}/pricing?from=waitlist`;

    const subject = "You're on the RentChain waitlist";
    const text = buildEmailText({
      intro: `Thanks${nameRaw ? `, ${nameRaw}` : ""} - you're on the RentChain waitlist. We'll email you when Micro-Live invites open.`,
      ctaText: "View pricing",
      ctaUrl: ctaLink,
    });

    try {
      await sendEmail({
        to: email,
        from: from as string,
        subject,
        text,
        html: buildEmailHtml({
          title: "You're on the RentChain waitlist",
          intro: `Thanks${nameRaw ? `, ${nameRaw}` : ""} for your interest. We'll email you when Micro-Live invites open.`,
          ctaText: "View pricing",
          ctaUrl: ctaLink,
        }),
      });
      emailed = true;
      console.info("[waitlist] email sent", { to: maskEmail(email), provider: "sendgrid" });
    } catch (e: any) {
      console.error("[waitlist] sendgrid send failed", {
        to: maskEmail(email),
        message: e?.message,
        code: e?.code || e?.response?.statusCode,
        body: e?.response?.body,
      });
      return res
        .status(502)
        .json({ ok: false, error: "WAITLIST_EMAIL_SEND_FAILED", emailed: false });
    }

    return res.json({ ok: true, emailed });
  } catch (err: any) {
    console.error("[POST /api/public/waitlist] error", err?.message || err);
    await incrementCounter({ name: "waitlist_invite_failed", dims: { reason: "server_error" }, amount: 1 });
    return res.status(500).json({ ok: false, error: "Server error", emailed: false });
  }
});

router.get("/waitlist/_ping", (_req, res) => res.json({ ok: true, route: "waitlist" }));

router.get("/waitlist/health", (_req, res) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  return res.json({
    ok: true,
    sendgridConfigured: Boolean(apiKey),
    fromSet: Boolean(from),
  });
});

export default router;
