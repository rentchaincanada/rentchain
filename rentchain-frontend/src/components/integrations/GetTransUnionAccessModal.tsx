import React from "react";
import { Button, Card } from "../ui/Ui";
import { colors, radius, shadows, spacing, text } from "@/styles/tokens";

const CHHAVI_EMAIL = "Chhavi.kumar@transunion.com";
const CHHAVI_PHONE = "289-208-7386";
const CUSTOMER_SUPPORT_PHONE = "1-800-565-2280";
const TECH_SUPPORT_PHONE = "(877) 559-5585 Option 4";
const TECH_SUPPORT_EMAIL = "clientsupport@transunion.com";
const MAILTO_SUBJECT = "TransUnion Credentialing Request for RentChain Screening";
const MAILTO_BODY = [
  "Hello Chhavi,",
  "",
  "I would like to start the credentialing process for TransUnion tenant screening so I can connect my business account in RentChain.",
  "",
  "Business name:",
  "Primary contact name:",
  "Primary contact email:",
  "Primary contact phone:",
  "",
  "Please let me know the next steps and any information required for credentialing.",
  "",
  "Thank you,",
].join("\n");
const CHHAVI_MAILTO = `mailto:${CHHAVI_EMAIL}?subject=${encodeURIComponent(MAILTO_SUBJECT)}&body=${encodeURIComponent(
  MAILTO_BODY
)}`;
const CHHAVI_TEL = `tel:${CHHAVI_PHONE.replace(/[^\d+]/g, "")}`;
const EMAIL_TEMPLATE = `To: ${CHHAVI_EMAIL}
Subject: ${MAILTO_SUBJECT}

${MAILTO_BODY}`;
const EMAIL_HANDOFF_COOLDOWN_MS = 1500;

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onMarkInProgress: () => Promise<void> | void;
  onEnterCredentials?: () => void;
  onEmailClick?: () => void;
  onPhoneClick?: () => void;
  onAlreadyCredentialedClick?: () => void;
};

export function GetTransUnionAccessModal({
  open,
  submitting = false,
  onClose,
  onMarkInProgress,
  onEnterCredentials,
  onEmailClick,
  onPhoneClick,
  onAlreadyCredentialedClick,
}: Props) {
  const [emailOpening, setEmailOpening] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<string | null>(null);
  const emailCooldownRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (emailCooldownRef.current != null) {
        window.clearTimeout(emailCooldownRef.current);
      }
    };
  }, []);

  if (!open) return null;

  const handleEmailClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (emailOpening) return;

    setEmailOpening(true);
    setEmailStatus("Email opened — send from your mail app");
    onEmailClick?.();
    window.location.assign(CHHAVI_MAILTO);

    emailCooldownRef.current = window.setTimeout(() => {
      setEmailOpening(false);
    }, EMAIL_HANDOFF_COOLDOWN_MS);
  };

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL_TEMPLATE);
      setEmailStatus("Email template copied — paste it into your mail app");
    } catch {
      setEmailStatus("Copy failed — use the email text shown here in your mail app");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get TransUnion Access"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.md,
        zIndex: 1000,
      }}
    >
      <Card
        elevated
        style={{
          width: "min(560px, 100%)",
          borderRadius: radius.lg,
          boxShadow: shadows.pop,
          display: "grid",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Get TransUnion Access</h2>
          <p style={{ margin: 0, color: text.muted, lineHeight: 1.6 }}>
            To use TransUnion screening through RentChain, your business must first be credentialed
            by TransUnion. Once approved, you’ll receive a member code and passcode to enter in
            RentChain.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: spacing.sm,
          }}
        >
          {[
            { label: "Not connected", state: "complete" },
            { label: "Get access", state: "current" },
            { label: "Return to connect", state: "upcoming" },
          ].map((step) => (
            <div
              key={step.label}
              style={{
                border: `1px solid ${step.state === "upcoming" ? colors.border : colors.accent}`,
                background: step.state === "upcoming" ? colors.bg : colors.accentSoft,
                borderRadius: radius.md,
                padding: spacing.sm,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700 }}>{step.label}</div>
              <div style={{ color: text.muted, fontSize: "0.85rem" }}>
                {step.state === "current" ? "Current step" : step.state === "complete" ? "Completed" : "Upcoming"}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
            color: text.subtle,
            fontSize: "0.92rem",
          }}
        >
          <div style={{ fontWeight: 700, color: text.primary, marginBottom: 8 }}>How credentialing works</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Contact TransUnion.</li>
            <li>Get credentialed for your business.</li>
            <li>Receive your member code and passcode.</li>
            <li>Return to RentChain and connect your credentials.</li>
          </ol>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: "#fff",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700, color: text.primary }}>TransUnion contact</div>
          <div style={{ color: text.primary, lineHeight: 1.6 }}>
            <div>Chhavi Kumar</div>
            <div>Account Executive, Inside Sales</div>
            <div>{CHHAVI_EMAIL}</div>
            <div>{CHHAVI_PHONE}</div>
            <div>Customer Support: {CUSTOMER_SUPPORT_PHONE}</div>
            <div>Tech Support: {TECH_SUPPORT_PHONE}</div>
            <div>{TECH_SUPPORT_EMAIL}</div>
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <a
              href={CHHAVI_MAILTO}
              onClick={handleEmailClick}
              aria-disabled={emailOpening}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: emailOpening ? colors.bg : colors.accentSoft,
                color: text.primary,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                pointerEvents: emailOpening ? "none" : "auto",
                opacity: emailOpening ? 0.7 : 1,
              }}
            >
              Email Chhavi Kumar
            </a>
            <a
              href={CHHAVI_TEL}
              onClick={onPhoneClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: text.primary,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Call Chhavi Kumar
            </a>
            <Button type="button" variant="secondary" onClick={() => void handleCopyTemplate()}>
              Copy email template
            </Button>
          </div>
          {emailStatus ? (
            <div
              role="status"
              aria-live="polite"
              style={{ color: text.muted, fontSize: "0.9rem", lineHeight: 1.5 }}
            >
              {emailStatus}
            </div>
          ) : null}
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: "#fff",
            color: text.primary,
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          Expected outcome: your account will be marked as credentialing in progress so you always
          know the next step is to return and connect the issued membership details.
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.bg,
            color: text.muted,
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          Connection details are not available yet. If the connection window does not open on mobile, try again or continue on desktop.
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: "rgba(15,118,110,0.06)",
            color: text.muted,
            fontSize: "0.92rem",
            lineHeight: 1.6,
          }}
        >
          RentChain remains your screening workflow home. Once you receive your credentials, come
          back here to connect and continue screening applicants.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
          {onEnterCredentials ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onAlreadyCredentialedClick?.();
                onEnterCredentials();
              }}
              disabled={submitting}
            >
              Already Credentialed?
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button type="button" onClick={() => void onMarkInProgress()} disabled={submitting}>
            {submitting ? "Saving..." : "Get TransUnion Access"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
