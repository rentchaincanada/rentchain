import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

type SendResult = { ok: true } | { ok: false; error: string };

export type EmailMessage = {
  to: string | string[];
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

let lastEmailPreview: any = null;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toCsvRecipients(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.map((v) => safeStr(v)).filter(Boolean).join(",");
  return safeStr(value || "");
}

function maskEmail(value: string): string {
  const email = safeStr(value);
  const [local, domain] = email.split("@");
  if (!local || !domain) return email ? "***" : "";
  const maskedLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

function getCorrelationId(): string {
  return `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function sendViaMailgun(message: EmailMessage): Promise<void> {
  const correlationId = getCorrelationId();
  const apiKey = safeStr(process.env.MAILGUN_API_KEY);
  const domain = safeStr(process.env.MAILGUN_DOMAIN);
  const from = safeStr(message.from || process.env.EMAIL_FROM || process.env.FROM_EMAIL);
  const to = toCsvRecipients(message.to);
  const subject = safeStr(message.subject);
  const html = safeStr(message.html || "");
  const text = safeStr(message.text || "");
  const replyTo = safeStr(message.replyTo || "");

  if (!apiKey) throw new Error("MAILGUN_API_KEY missing");
  if (!domain) throw new Error("MAILGUN_DOMAIN missing");
  if (!from) throw new Error("EMAIL_FROM missing");
  if (!to) throw new Error("email_to_missing");
  if (!subject) throw new Error("email_subject_missing");
  if (!html && !text) throw new Error("email_body_missing");

  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  params.set("subject", subject);
  if (html) params.set("html", html);
  if (text) params.set("text", text);
  const cc = toCsvRecipients(message.cc);
  if (cc) params.set("cc", cc);
  const bcc = toCsvRecipients(message.bcc);
  if (bcc) params.set("bcc", bcc);
  if (replyTo) params.set("h:Reply-To", replyTo);

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const url = `https://api.mailgun.net/v3/${domain}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[email] provider error", {
      provider: "mailgun",
      correlationId,
      status: response.status,
      responseBody: responseText.slice(0, 500),
    });
    throw new Error(`mailgun_send_failed:${response.status}`);
  }

  lastEmailPreview = {
    provider: "mailgun",
    correlationId,
    to: to.split(",").map(maskEmail),
    subject,
    sentAt: new Date().toISOString(),
  };
}

export function getLastEmailPreview() {
  return lastEmailPreview;
}

export async function sendWaitlistConfirmation(params: {
  to: string;
  name?: string | null;
}): Promise<SendResult> {
  const from = safeStr(process.env.WAITLIST_FROM_EMAIL || process.env.EMAIL_FROM || process.env.FROM_EMAIL);
  const replyTo = safeStr(process.env.WAITLIST_REPLYTO_EMAIL || from);

  if (!from) return { ok: false, error: "EMAIL_FROM missing" };

  try {
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
    return { ok: false, error: e?.message || "email_send_failed" };
  }
}

export async function sendEmail(message: EmailMessage) {
  const provider = safeStr(process.env.EMAIL_PROVIDER || "mailgun").toLowerCase();
  if (provider !== "mailgun") {
    throw new Error(`EMAIL_PROVIDER_UNSUPPORTED:${provider || "unset"}`);
  }
  await sendViaMailgun(message);
}
