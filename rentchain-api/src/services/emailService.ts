import sgMail from "@sendgrid/mail";

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
