type BuildEmailHtmlParams = {
  title: string;
  intro: string;
  bullets?: string[];
  ctaText: string;
  ctaUrl: string;
  footerNote?: string;
  preheader?: string;
};

type BuildEmailTextParams = {
  intro: string;
  bullets?: string[];
  ctaText: string;
  ctaUrl: string;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEmailHtml(params: BuildEmailHtmlParams): string {
  const {
    title,
    intro,
    bullets = [],
    ctaText,
    ctaUrl,
    footerNote = "If you didn't request this, you can ignore this email.",
    preheader = "",
  } = params;

  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeCtaText = escapeHtml(ctaText);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeFooterNote = escapeHtml(footerNote);
  const safePreheader = escapeHtml(preheader);

  const bulletHtml = bullets.length
    ? `<ul style="margin:12px 0 20px 22px;padding:0;font-size:15px;line-height:1.7;color:#334155;">${bullets
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";

  return [
    `<div style="margin:0;padding:24px;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7eaf0;border-radius:16px;padding:28px;box-shadow:0 6px 24px rgba(15,23,42,0.06);">`,
    safePreheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
      : "",
    `<h1 style="margin:0 0 10px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;">${safeTitle}</h1>`,
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">${safeIntro}</p>`,
    bulletHtml,
    `<a href="${safeCtaUrl}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.2px;padding:14px 22px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">${safeCtaText}</a>`,
    `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#475569;">Button not working? Copy and paste this URL:</p>`,
    `<div style="margin:6px 0 0;background:#f1f5f9;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;word-break:break-all;">`,
    `<a href="${safeCtaUrl}" style="font-size:12px;line-height:1.5;color:#0f172a;text-decoration:none;">${safeCtaUrl}</a>`,
    `</div>`,
    `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b;">${safeFooterNote}</p>`,
    `</div></div>`,
  ].join("");
}

export function buildEmailText(params: BuildEmailTextParams): string {
  const {
    intro,
    bullets = [],
    ctaText,
    ctaUrl,
    footerNote = "If you didn't request this, you can ignore this email.",
  } = params;

  const lines: string[] = [intro, ""];
  if (bullets.length) {
    lines.push(...bullets.map((item) => `- ${item}`), "");
  }
  lines.push(
    `${ctaText}:`,
    ctaUrl,
    "",
    "Button not working? Copy and paste this URL:",
    ctaUrl,
    "",
    footerNote
  );
  return lines.join("\n");
}
