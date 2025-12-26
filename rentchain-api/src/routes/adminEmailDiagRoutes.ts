import { Router } from "express";
import sgMail from "@sendgrid/mail";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/diag/email", requireAdmin, async (_req: any, res) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  return res.json({
    ok: true,
    hasSendgridKey: Boolean(apiKey && apiKey.length > 10),
    fromSet: Boolean(from),
    from,
  });
});

router.post("/diag/email/send-test", requireAdmin, async (req: any, res) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  const to = String(req.body?.to || "").trim();

  if (!to.includes("@")) return res.status(400).json({ ok: false, error: "Invalid to" });
  if (!apiKey || !from) return res.status(500).json({ ok: false, error: "SendGrid env not set" });

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to,
      from,
      subject: "RentChain SendGrid test",
      text: "If you received this, SendGrid is working.",
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Send failed",
      code: e?.code || null,
      responseStatus: e?.response?.statusCode || null,
      responseBody: e?.response?.body || null,
    });
  }
});

export default router;
