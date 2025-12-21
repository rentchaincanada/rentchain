import nodemailer from "nodemailer";

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
