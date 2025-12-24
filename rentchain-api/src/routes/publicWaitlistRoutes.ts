import { Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import sgMail from "@sendgrid/mail";

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
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

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
    const from = process.env.SENDGRID_FROM_EMAIL;
    const appUrl = process.env.PUBLIC_APP_URL || "";
    if (apiKey && from) {
      sgMail.setApiKey(apiKey);

      const subject = "You're on the RentChain waitlist";
      const text =
        `Thanks${nameRaw ? `, ${nameRaw}` : ""} - you're on the RentChain waitlist.\n\n` +
        "We'll email you when Micro-Live invites open.\n" +
        (appUrl ? `\nRentChain: ${appUrl}\n` : "") +
        `\nIf you didn't request this, ignore this email.\n`;

      await sgMail.send({
        to: email,
        from,
        subject,
        text,
      });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[POST /api/public/waitlist] error", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.get("/waitlist/_ping", (_req, res) => res.json({ ok: true, route: "waitlist" }));

export default router;
