import React from "react";
import { useParams } from "react-router-dom";
import {
  getRecipientTrustReview,
  type RecipientTrustReviewResponse,
  type RecipientTrustReviewSummary,
} from "../api/recipientTrustReview";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
  padding: "32px 20px",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 20,
};

function pretty(value: string | null | undefined) {
  return String(value || "Not available").replace(/_/g, " ");
}

function dateValue(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function sessionStorageKey(grantId: string) {
  return `recipientTrustReviewSession:${grantId}`;
}

function loadStoredSessionId(grantId: string) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(sessionStorageKey(grantId));
}

function storeSessionId(grantId: string, sessionId: string | null | undefined) {
  if (typeof window === "undefined" || !sessionId) return;
  window.sessionStorage.setItem(sessionStorageKey(grantId), sessionId);
}

function clearStoredSessionId(grantId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(sessionStorageKey(grantId));
}

function MetadataList({ summary }: { summary: RecipientTrustReviewSummary }) {
  if (!summary.includedClaims.length) {
    return <div style={{ color: "#64748b" }}>No active trust metadata is available for this review.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {summary.includedClaims.map((claim, index) => (
        <div
          key={`${claim.claimCategory}-${index}`}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 700 }}>{claim.claimLabel}</div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            {pretty(claim.claimCategory)} · {pretty(claim.lifecycleState)}
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>Consent expires: {dateValue(claim.consentExpiresAt)}</div>
        </div>
      ))}
    </div>
  );
}

export default function RecipientTrustReviewPage() {
  const { grantId = "" } = useParams();
  const [state, setState] = React.useState<{
    loading: boolean;
    data: RecipientTrustReviewResponse | null;
    error: string | null;
  }>({ loading: true, data: null, error: null });
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: null });
    getRecipientTrustReview(grantId, loadStoredSessionId(grantId), false)
      .then((data) => {
        if (!cancelled) {
          storeSessionId(grantId, data.summary?.session?.sessionId);
          setState({ loading: false, data, error: null });
        }
      })
      .catch((err: any) => {
        const decision = err?.body?.decision;
        const reason = decision?.reason || err?.body?.error || err?.message || "Unable to load this trust review.";
        if (!cancelled) {
          if (
            decision?.status === "session_expired" ||
            decision?.status === "session_revoked" ||
            decision?.status === "reauthentication_required"
          ) {
            clearStoredSessionId(grantId);
          }
          setState({ loading: false, data: null, error: pretty(reason) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [grantId]);

  const summary = state.data?.summary || null;
  const onboardingRequired = summary?.onboarding?.acknowledgementRequired && !summary.onboarding.acknowledged;

  function acknowledgeOnboarding() {
    setAcknowledging(true);
    getRecipientTrustReview(grantId, loadStoredSessionId(grantId), true)
      .then((data) => {
        storeSessionId(grantId, data.summary?.session?.sessionId);
        setState({ loading: false, data, error: null });
      })
      .catch((err: any) => {
        const decision = err?.body?.decision;
        const reason = decision?.reason || err?.body?.error || err?.message || "Unable to complete this onboarding step.";
        if (
          decision?.status === "session_expired" ||
          decision?.status === "session_revoked" ||
          decision?.status === "reauthentication_required"
        ) {
          clearStoredSessionId(grantId);
        }
        setState({ loading: false, data: null, error: pretty(reason) });
      })
      .finally(() => setAcknowledging(false));
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={panelStyle}>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>
            Tenant-authorized trust review
          </div>
          <h1 style={{ margin: "8px 0", fontSize: 28, lineHeight: 1.2 }}>Metadata-only recipient review</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            This view is authenticated, tenant-mediated, audience-scoped, purpose-scoped, and view-only. It is not an
            approval, eligibility, credit, insurance, subsidy, ownership, government, or automated decision.
          </p>
        </section>

        {state.loading ? (
          <section style={panelStyle}>Loading review...</section>
        ) : state.error ? (
          <section style={panelStyle} role="alert">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Review unavailable</div>
            <div style={{ color: "#475569" }}>{state.error}</div>
          </section>
        ) : summary ? (
          <>
            {onboardingRequired ? (
              <section style={panelStyle}>
                <h2 style={{ marginTop: 0, fontSize: 20 }}>{summary.onboarding.copy.title}</h2>
                <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.6 }}>{summary.onboarding.copy.intro}</p>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.7 }}>
                  {summary.onboarding.copy.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", lineHeight: 1.5 }}>
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      style={{ marginTop: 4 }}
                    />
                    <span>{summary.onboarding.copy.acknowledgement}</span>
                  </label>
                  <button type="button" disabled={!acknowledged || acknowledging} onClick={acknowledgeOnboarding}>
                    {acknowledging ? "Preparing review..." : "Continue to metadata review"}
                  </button>
                </div>
                <div style={{ marginTop: 16, color: "#64748b", lineHeight: 1.6 }}>
                  {summary.onboarding.copy.supportGuidance.join(" ")}
                </div>
              </section>
            ) : null}
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Review scope</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Recipient</div>
                  <div style={{ fontWeight: 700 }}>{summary.recipient.email}</div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Audience</div>
                  <div style={{ fontWeight: 700 }}>{pretty(summary.audience)}</div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Purpose</div>
                  <div style={{ fontWeight: 700 }}>{pretty(summary.purpose)}</div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Expires</div>
                  <div style={{ fontWeight: 700 }}>{dateValue(summary.expiresAt)}</div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Review session expires</div>
                  <div style={{ fontWeight: 700 }}>{dateValue(summary.session.expiresAt)}</div>
                </div>
              </div>
            </section>

            {!onboardingRequired ? (
              <section style={panelStyle}>
                <h2 style={{ marginTop: 0, fontSize: 20 }}>Included metadata</h2>
                <MetadataList summary={summary} />
              </section>
            ) : null}

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Excluded metadata</h2>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.7 }}>
                {summary.redactions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>Recipient downloads are disabled.</li>
                <li>Public profiles and public trust URLs are not created.</li>
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
