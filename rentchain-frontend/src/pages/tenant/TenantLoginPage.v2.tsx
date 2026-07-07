import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../../api/apiFetch";
import { LoginForm } from "../../components/auth/LoginForm";
import {
  authBodyStyle,
  authCardStyle,
  authGhostButtonStyle,
  authLinkStyle,
  authPalette,
  authSecondaryButtonStyle,
  authShellStyle,
} from "../../components/auth/authPageStyles";
import {
  resolveTenantPostAuthDestination,
  TENANT_DEFAULT_DESTINATION,
} from "../../lib/authDestination";
import { trackAuthEvent } from "../../lib/authAnalytics";

const TenantLoginPageV2: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const next = useMemo(() => {
    const resolved = resolveTenantPostAuthDestination({
      search: location.search,
      fallback: TENANT_DEFAULT_DESTINATION,
    });
    return resolved.destination;
  }, [location.search]);
  const inviteToken = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
  const inviteSource = useMemo(() => new URLSearchParams(location.search).get("source") || "", [location.search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    setSent(false);
    try {
      await apiFetch("/tenant/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), next }),
        headers: { "Content-Type": "application/json" },
      });
      trackAuthEvent("auth.onboard.magic_link_requested", {
        source: "tenant-login",
        destination: next,
        inviteType: inviteSource || null,
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Couldn’t send link. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (!sent) {
    return (
      <LoginForm
        title="Tenant login"
        subtitle="We will email you a one-time login link."
        roleLabel="Tenant access"
        email={email}
        onEmailChange={setEmail}
        passwordRequired={false}
        showForgotPassword={false}
        onSubmit={onSubmit}
        isLoading={isSending}
        disabled={!email.trim()}
        error={error}
        submitLabel="Email me a login link"
        loadingLabel="Sending..."
        statusMessage="Use the email associated with your tenant profile."
        banner={
          inviteToken
            ? {
                title: "Invite context detected",
                body: "We will return you to onboarding after sign-in.",
              }
            : null
        }
        footer={
          <div style={{ fontSize: 13, color: authPalette.muted }}>
            Have an invite link? Open it to accept your invite. <Link to="/" style={authLinkStyle}>Back to main</Link>
          </div>
        }
      />
    );
  }

  return (
    <div style={authShellStyle}>
      <div style={authCardStyle("min(480px, 92vw)")}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: authPalette.ink }}>Tenant login</h1>
        <p style={{ ...authBodyStyle, marginTop: 8 }}>We will email you a one-time login link.</p>
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ color: "#365314", fontWeight: 700 }}>
              If an account exists for that email, we sent a login link.
            </div>
            <div style={{ color: authPalette.muted, fontSize: 13 }}>Check your spam/junk folder.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={next || "/tenant"}
                style={{
                  ...authSecondaryButtonStyle,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Back
              </a>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{
                  ...authGhostButtonStyle,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Resend
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default TenantLoginPageV2;
