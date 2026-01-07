// Vercel serverless function for waitlist submissions
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const emailRaw = String(body?.email || "").trim().toLowerCase();
  const nameRaw = String(body?.name || "").trim();

  if (!emailRaw || !emailRaw.includes("@")) {
    return res.status(400).json({ ok: false, error: "Invalid email" });
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!sendgridKey || !fromEmail) {
    console.error("[waitlist] sendgrid not configured", {
      SENDGRID_API_KEY: !!sendgridKey,
      SENDGRID_FROM_EMAIL: !!fromEmail,
    });
    return res
      .status(500)
      .json({ ok: false, error: "WAITLIST_EMAIL_NOT_CONFIGURED" });
  }

  const subject = "You're on the RentChain waitlist";
  const text =
    `Thanks${nameRaw ? `, ${nameRaw}` : ""} - you're on the RentChain waitlist.\n\n` +
    "We'll email you when Micro-Live invites open.\n\n" +
    "If you didn't request this, ignore this email.\n";

  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: emailRaw }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: "text/plain", value: text }],
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
        mail_settings: {
          footer: { enable: false },
        },
      }),
    });

    if (!resp.ok) {
      const bodyText = await resp.text();
      console.error("[waitlist] sendgrid send failed", {
        status: resp.status,
        body: bodyText?.slice(0, 500),
      });
      return res
        .status(502)
        .json({ ok: false, error: "WAITLIST_EMAIL_SEND_FAILED" });
    }

    console.info("[waitlist] email sent", {
      to: maskEmail(emailRaw),
      provider: "sendgrid",
    });

    return res.status(200).json({ ok: true, already: false });
  } catch (err: any) {
    console.error("[waitlist] send error", { message: err?.message, stack: err?.stack });
    return res.status(502).json({ ok: false, error: "WAITLIST_EMAIL_SEND_FAILED" });
  }
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const maskedUser = user.length <= 1 ? "*" : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
}
