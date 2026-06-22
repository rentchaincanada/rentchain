import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "./emailService";
import type { DelegatedAccessInvitation } from "../lib/delegatedAccess";

type SendDelegatedAccessInvitationEmailInput = {
  invitation: DelegatedAccessInvitation;
  rawToken: string;
  invitedByEmail?: string | null;
  invitedByName?: string | null;
};

function safeString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function appBaseUrl(): string {
  return safeString(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://www.rentchain.ai").replace(/\/$/, "");
}

function roleLabel(role: string): string {
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scopeSummary(invitation: DelegatedAccessInvitation): string {
  const workspaces = invitation.workspaceScopes.length
    ? `Workspaces: ${invitation.workspaceScopes.map(roleLabel).join(", ")}`
    : "Workspaces: none";
  const propertyScope =
    invitation.propertyScope.mode === "selected"
      ? `Properties: ${invitation.propertyScope.propertyIds.length} selected`
      : `Properties: ${invitation.propertyScope.mode.replace(/_/g, " ")}`;
  return `${workspaces}. ${propertyScope}.`;
}

export function buildDelegatedAccessAcceptanceUrl(rawToken: string): string {
  const token = encodeURIComponent(safeString(rawToken, 2000));
  return `${appBaseUrl()}/delegated-access/accept?token=${token}`;
}

export async function sendDelegatedAccessInvitationEmail(input: SendDelegatedAccessInvitationEmailInput): Promise<void> {
  const from = safeString(process.env.DELEGATED_ACCESS_FROM_EMAIL || process.env.EMAIL_FROM || process.env.FROM_EMAIL);
  if (!from) throw new Error("EMAIL_FROM missing");

  const invitedBy =
    safeString(input.invitedByName, 160) ||
    safeString(input.invitedByEmail, 320) ||
    "A RentChain landlord owner";
  const role = roleLabel(input.invitation.role);
  const expiresAt = new Date(input.invitation.expiresAt).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const acceptanceUrl = buildDelegatedAccessAcceptanceUrl(input.rawToken);
  const bullets = [
    `Invited by: ${invitedBy}`,
    `Assigned role: ${role}`,
    scopeSummary(input.invitation),
    `Invitation expires: ${expiresAt} UTC`,
    "Use your own RentChain account. Never use or share the landlord owner's login credentials.",
  ];

  await sendEmail({
    to: input.invitation.inviteeEmail,
    from,
    subject: `${invitedBy} invited you to RentChain`,
    text: buildEmailText({
      intro: "You have been invited to access a RentChain landlord workspace as a delegate.",
      bullets,
      ctaText: "Accept delegated access",
      ctaUrl: acceptanceUrl,
      footerNote: "If you were not expecting this invitation, ignore this email or contact the landlord owner.",
    }),
    html: buildEmailHtml({
      title: "Accept delegated access",
      intro: "You have been invited to access a RentChain landlord workspace as a delegate.",
      bullets,
      ctaText: "Accept delegated access",
      ctaUrl: acceptanceUrl,
      footerNote: "If you were not expecting this invitation, ignore this email or contact the landlord owner.",
      preheader: "Use your own account to accept delegated access. Never share landlord credentials.",
    }),
  });
}
