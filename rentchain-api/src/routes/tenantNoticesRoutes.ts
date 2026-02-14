import { Router } from "express";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();

const ALLOWED_TYPES = ["GENERAL", "LATE_RENT", "ENTRY_NOTICE", "LEASE_UPDATE", "WARNING"];

router.post("/tenant-notices", authenticateJwt, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, type, title, body, effectiveAt } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    const trimmedBody = typeof body === "string" ? body.trim() : "";
    const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";
    const effAt =
      effectiveAt === null || effectiveAt === undefined
        ? null
        : Number.isFinite(Number(effectiveAt))
        ? Number(effectiveAt)
        : null;

    if (!tenantId || !trimmedTitle || !trimmedBody || !normalizedType) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    if (!ALLOWED_TYPES.includes(normalizedType)) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    if (trimmedBody.length > 10_000) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }

    // Ownership check + tenant lookup for email
    let tenantEmail: string | null = null;
    try {
      const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        const tenantLandlordId = t?.landlordId || t?.ownerId || t?.owner;
        if (tenantLandlordId && tenantLandlordId !== landlordId) {
          return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }
        tenantEmail = typeof t?.email === "string" ? t.email.trim() : null;
      }
    } catch {
      // ignore lookup errors; rely on auth fallback
    }

    const now = Date.now();
    const doc = {
      landlordId,
      tenantId: String(tenantId),
      type: normalizedType,
      title: trimmedTitle,
      body: trimmedBody,
      effectiveAt: effAt,
      createdAt: now,
      createdBy: req.user?.email || req.user?.id || null,
      status: "ACTIVE",
    };

    const ref = await db.collection("tenantNotices").add(doc);

    // Attempt non-blocking email
    let emailed = false;
    let emailError: string | undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = !!(tenantEmail && emailRegex.test(tenantEmail));

    if (!hasValidEmail) {
      emailError = "INVALID_TENANT_EMAIL";
    } else {
      const apiKey = process.env.SENDGRID_API_KEY;
      const from =
        process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
      const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const noticeLink = `${baseUrl}/tenant/notices/${ref.id}`;
      const excerpt = trimmedBody.length > 400 ? `${trimmedBody.slice(0, 400)}...` : trimmedBody;

      if (!apiKey || !from) {
        emailError = "EMAIL_NOT_CONFIGURED";
      } else {
        try {
          await sendEmail({
            to: tenantEmail as string,
            from,
            replyTo: replyTo || from,
            subject: `New notice from your landlord: ${trimmedTitle}`,
            text: buildEmailText({
              intro: `Notice type: ${normalizedType}\nTitle: ${trimmedTitle}\n\n${excerpt}`,
              ctaText: "View notice",
              ctaUrl: noticeLink,
            }),
            html: buildEmailHtml({
              title: `New notice: ${trimmedTitle}`,
              intro: `Notice type: ${normalizedType}. ${excerpt}`,
              ctaText: "View notice",
              ctaUrl: noticeLink,
            }),
          });
          emailed = true;
        } catch (err: any) {
          emailed = false;
          emailError = err?.message || "SEND_FAILED";
          console.error("[tenant-notices] email send failed", {
            noticeId: ref.id,
            tenantId,
            tenantEmail,
            errMessage: err?.message,
            errBody: err?.response?.body,
          });
        }
      }
    }

    return res.json({ ok: true, data: { id: ref.id, ...doc }, emailed, emailError });
  } catch (err) {
    console.error("[tenant-notices] create failed", err);
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_CREATE_FAILED" });
  }
});

export default router;
