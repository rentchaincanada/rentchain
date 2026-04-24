import React from "react";
import {
  acceptTenantScreeningConsent,
  markTenantScreeningViewed,
  type TenantScreeningRequest,
} from "../../api/tenantScreeningApi";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";

const CONSENT_VERSION = "screening-consent-v2";

function formatDateTime(value: number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function resolveProviderLabel(screening: TenantScreeningRequest) {
  if (screening.consent?.providerLabel) return screening.consent.providerLabel;
  if (screening.providerLabel) return screening.providerLabel;
  if (screening.provider === "transunion_redirect") return "TransUnion";
  if (screening.provider === "equifax") return "Equifax";
  if (screening.provider === "manual") return "Manual review";
  return "Selected screening provider";
}

function buildConsentSummary(screening: TenantScreeningRequest) {
  const providerLabel = resolveProviderLabel(screening);
  const propertyContext = [screening.propertyLabel, screening.unitLabel].filter(Boolean).join(" - ");
  const propertySegment = propertyContext ? ` for ${propertyContext}` : "";
  return `The landlord requested tenant screening${propertySegment}. A third-party screening provider may be used, including ${providerLabel} when applicable. RentChain records consent and screening workflow status for audit and application review purposes.`;
}

function buildProviderDisclosure(screening: TenantScreeningRequest) {
  const providerLabel = resolveProviderLabel(screening);
  return `The landlord is requesting screening for this rental application. A third-party screening provider may be used, including ${providerLabel} when applicable.`;
}

function nextStepCopy(screening: TenantScreeningRequest) {
  if (screening.status === "manual_review_required") {
    return "Your consent has been recorded. Screening setup is being completed by the landlord.";
  }
  if (screening.status === "consented" || screening.consent?.acceptedAt) {
    return "Your consent has been recorded. The landlord can continue reviewing your application.";
  }
  return "Consent is required before screening can proceed.";
}

type Props = {
  screening: TenantScreeningRequest;
  onConsentUpdated?: (screening: TenantScreeningRequest) => void;
};

export default function TenantScreeningConsentCard({ screening, onConsentUpdated }: Props) {
  const [checked, setChecked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const providerLabel = resolveProviderLabel(screening);
  const acceptedAt = screening.consent?.acceptedAt || screening.consentedAt || null;
  const propertyContext = [screening.propertyLabel, screening.unitLabel].filter(Boolean).join(" - ");
  const disclosure = screening.consent?.providerDisclosure || buildProviderDisclosure(screening);
  const consentSummary = screening.consent?.consentTextSummary || buildConsentSummary(screening);

  React.useEffect(() => {
    if (acceptedAt || screening.status !== "consent_pending") return;
    void markTenantScreeningViewed(screening.id, {
      providerDisclosure: disclosure,
      disclosureVersion: CONSENT_VERSION,
      consentSummary,
    }).catch(() => undefined);
  }, [acceptedAt, consentSummary, disclosure, screening.id, screening.status]);

  const submitConsent = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await acceptTenantScreeningConsent(screening.id, {
        providerDisclosure: disclosure,
        disclosureVersion: CONSENT_VERSION,
        consentSummary,
      });
      onConsentUpdated?.(response.screeningRequest);
      setChecked(false);
    } catch (err: any) {
      setError(err?.message || err?.payload?.error || "Unable to record your screening consent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        background: colors.panel,
        padding: spacing.md,
        display: "grid",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, color: textTokens.primary, fontSize: "1rem" }}>
            {acceptedAt ? "Screening consent confirmed" : "Screening consent required"}
          </div>
          <div style={{ color: textTokens.secondary, marginTop: 4, lineHeight: 1.5 }}>
            {nextStepCopy(screening)}
          </div>
        </div>
        <div
          style={{
            alignSelf: "start",
            padding: "6px 10px",
            borderRadius: 999,
            background: acceptedAt ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.14)",
            color: acceptedAt ? "#166534" : "#92400e",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          {acceptedAt ? "Consent confirmed" : "Action needed"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, color: textTokens.secondary }}>
        <div>
          The landlord is requesting tenant screening for this rental application.
        </div>
        <div>
          Provider: <strong style={{ color: textTokens.primary }}>{providerLabel}</strong>
        </div>
        {propertyContext ? (
          <div>
            Application context: <strong style={{ color: textTokens.primary }}>{propertyContext}</strong>
          </div>
        ) : null}
        <div>
          A third-party provider may be used to verify identity, credit, background, or rental suitability depending on the screening product selected.
        </div>
        <div>
          Results are made available to the landlord according to the screening workflow and access rules.
        </div>
        <div style={{ color: textTokens.muted }}>
          RentChain records your consent and screening workflow status for audit and application review purposes.
        </div>
      </div>

      {acceptedAt ? (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: radius.md,
            background: colors.card,
            border: `1px solid ${colors.border}`,
            color: textTokens.secondary,
          }}
        >
          <div>
            Confirmed at: <strong style={{ color: textTokens.primary }}>{formatDateTime(acceptedAt)}</strong>
          </div>
          <div>
            Provider: <strong style={{ color: textTokens.primary }}>{providerLabel}</strong>
          </div>
          <div>{consentSummary}</div>
        </div>
      ) : (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: textTokens.primary,
              cursor: "pointer",
            }}
          >
            <input
              aria-label="Authorize screening consent"
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              I authorize the requested tenant screening for this rental application and understand that a third-party screening provider may be used.
            </span>
          </label>

          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!checked || submitting}
              onClick={() => void submitConsent()}
              style={{
                padding: "10px 14px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: !checked || submitting ? "#e2e8f0" : colors.accent,
                color: !checked || submitting ? "#64748b" : "#fff",
                fontWeight: 700,
                cursor: !checked || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Authorizing..." : "Authorize screening"}
            </button>
            <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
              Consent is required before screening can proceed.
            </div>
          </div>
        </>
      )}

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
    </div>
  );
}
