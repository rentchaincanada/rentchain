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
const PROVIDER_OPTIONS = [
  {
    label: "TransUnion",
    status: "Live provider path",
    detail: "Requires provider credentialing before live screening can begin.",
  },
  {
    label: "Manual/offline screening",
    status: "Available fallback",
    detail: "Use manual review when live provider screening is unavailable or not appropriate.",
  },
  {
    label: "Certn",
    status: "Candidate provider",
    detail: "Workflow-ready candidate. Integration is not active yet.",
  },
  {
    label: "Equifax",
    status: "Candidate provider",
    detail: "Future provider path candidate. Integration is not active yet.",
  },
] as const;

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
      aria-label="Screening provider setup"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "clamp(12px, 3vw, 24px)",
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      <Card
        elevated
        style={{
          boxSizing: "border-box",
          width: "min(760px, 100%)",
          maxHeight: "calc(100dvh - 24px)",
          borderRadius: radius.lg,
          boxShadow: shadows.pop,
          display: "grid",
          gap: spacing.md,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Screening provider setup</h2>
          <p style={{ margin: 0, color: text.muted, lineHeight: 1.6 }}>
            Choose or manage a screening workflow provider before ordering reports. Provider
            availability can vary by setup status, consent requirements, and integration readiness.
          </p>
        </div>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700, color: text.primary }}>Provider options</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.sm,
            }}
          >
            {PROVIDER_OPTIONS.map((provider) => (
              <div
                key={provider.label}
                style={{
                  border: `1px solid ${provider.label === "TransUnion" ? colors.accent : colors.border}`,
                  background: provider.label === "TransUnion" ? colors.accentSoft : "#fff",
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>{provider.label}</div>
                <div style={{ color: text.primary, fontSize: "0.9rem", fontWeight: 700 }}>{provider.status}</div>
                <div style={{ color: text.muted, fontSize: "0.9rem", lineHeight: 1.45 }}>{provider.detail}</div>
              </div>
            ))}
          </div>
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
            { label: "Provider access", state: "current" },
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
            <li>Choose the provider path or manual workflow that fits the applicant review.</li>
            <li>For live provider screening, complete provider credentialing for your business.</li>
            <li>Receive any provider-issued member code and passcode.</li>
            <li>Return to RentChain and connect your credentials.</li>
          </ol>
        </div>
        <details
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: "#fff",
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700, color: text.primary }}>
            TransUnion provider contact details
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.75fr)",
              gap: 8,
              marginTop: spacing.sm,
            }}
          >
            <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
              <div style={{ color: text.primary, lineHeight: 1.6, overflowWrap: "anywhere" }}>
                <div>Chhavi Kumar</div>
                <div>Account Executive, Inside Sales</div>
                <div>{CHHAVI_EMAIL}</div>
                <div>{CHHAVI_PHONE}</div>
                <div>Customer Support: {CUSTOMER_SUPPORT_PHONE}</div>
                <div>Tech Support: {TECH_SUPPORT_PHONE}</div>
                <div>{TECH_SUPPORT_EMAIL}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: spacing.sm, alignContent: "start", minWidth: 0 }}>
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
            <div style={{ gridColumn: "1 / -1" }}>
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
          </div>
        </details>
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
          Expected outcome: your screening workflow will be marked as credentialing in progress so
          you always know the next step is to return and connect the issued membership details.
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
            {submitting ? "Saving..." : "Start provider setup"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
