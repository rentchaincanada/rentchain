import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

type SendEmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

let lastEmailPreview: SendEmailPayload | null = null;

function smtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  lastEmailPreview = payload;

  if (!smtpConfigured()) {
    console.log("[email preview]", {
      to: payload.to,
      subject: payload.subject,
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

export function getLastEmailPreview(): SendEmailPayload | null {
  return lastEmailPreview;
}

type SendResult = { ok: true } | { ok: false; error: string };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

/**
 * SendGrid-backed waitlist confirmation (does not throw; returns SendResult)
 */
export async function sendWaitlistConfirmation(params: {
  to: string;
  name?: string | null;
}): Promise<SendResult> {
  const key = safeStr(process.env.SENDGRID_API_KEY);
  const from = safeStr(process.env.WAITLIST_FROM_EMAIL);
  const replyTo = safeStr(process.env.WAITLIST_REPLYTO_EMAIL || from);

  if (!key) return { ok: false, error: "SENDGRID_API_KEY missing" };
  if (!from) return { ok: false, error: "WAITLIST_FROM_EMAIL missing" };

  try {
    sgMail.setApiKey(key);

    const to = safeStr(params.to);
    const name = safeStr(params.name || "");
    const greet = name ? `Hi ${name},` : "Hi,";

    await sgMail.send({
      to,
      from,
      replyTo,
      subject: "You’re on the RentChain waitlist",
      text: `${greet}\n\nThanks for joining the RentChain waitlist. We’ll reach out shortly for private onboarding.\n\n— RentChain`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>You’re on the list ✅</h2>
          <p>${greet}</p>
          <p>Thanks for joining the RentChain waitlist.</p>
          <p>We’ll reach out shortly for private onboarding.</p>
          <p style="color:#666;font-size:12px;margin-top:24px">— RentChain</p>
        </div>
      `,
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "SendGrid send failed" };
  }
}
