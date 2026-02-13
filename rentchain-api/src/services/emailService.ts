import sgMail from "@sendgrid/mail";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

type SendResult = { ok: true } | { ok: false; error: string };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

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
    const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const ctaLink = `${baseUrl}/pricing?from=waitlist`;

    await sendEmail({
      to,
      from,
      replyTo,
      subject: "You're on the RentChain waitlist",
      text: buildEmailText({
        intro: `${greet}\n\nThanks for joining the RentChain waitlist. We'll reach out shortly for private onboarding.`,
        ctaText: "View pricing",
        ctaUrl: ctaLink,
        footerNote: "If you didn't request this, you can ignore this email.",
      }),
      html: buildEmailHtml({
        title: "You're on the RentChain waitlist",
        intro: `${greet} Thanks for joining the RentChain waitlist. We'll reach out shortly for private onboarding.`,
        ctaText: "View pricing",
        ctaUrl: ctaLink,
      }),
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "SendGrid send failed" };
  }
}

export async function sendEmail(message: sgMail.MailDataRequired) {
  const key = safeStr(process.env.SENDGRID_API_KEY);
  const from =
    safeStr(process.env.SENDGRID_FROM_EMAIL) ||
    safeStr(process.env.SENDGRID_FROM) ||
    safeStr(process.env.FROM_EMAIL);

  if (!key) throw new Error("SENDGRID_API_KEY missing");
  if (!message.from && !from) throw new Error("SENDGRID_FROM_EMAIL missing");

  sgMail.setApiKey(key);
  await sgMail.send({
    ...message,
    from: message.from || from,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
    mailSettings: {
      footer: { enable: false },
    },
  });
}
