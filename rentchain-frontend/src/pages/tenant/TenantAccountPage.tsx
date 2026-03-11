import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tenantApiFetch } from "../../api/tenantApiFetch";
import { Card } from "../../components/ui/Ui";
import { logoutTenant } from "../../lib/logoutTenant";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

type TenantMeResponse = {
  ok: boolean;
  data?: {
    tenant?: {
      shortId?: string | null;
      email?: string | null;
    };
  };
};

function valueOrDash(value?: string | null): string {
  const trimmed = String(value || "").trim();
  return trimmed || "—";
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: textTokens.primary,
  marginBottom: spacing.xs,
};

export default function TenantAccountPage() {
  const [data, setData] = useState<TenantMeResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tenantApiFetch<TenantMeResponse>("/tenant/me");
        if (!cancelled) setData(res?.data || null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load account details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card elevated style={{ padding: spacing.lg, display: "grid", gap: spacing.md }}>
      <div>
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Account</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Manage your tenant account and security actions.
        </div>
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
      {loading ? <div style={{ color: textTokens.muted }}>Loading account…</div> : null}

      {!loading ? (
        <>
          <section>
            <div style={sectionTitleStyle}>Account</div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Email</div>
            <div style={{ color: textTokens.primary, fontWeight: 600, marginBottom: 10 }}>
              {valueOrDash(data?.tenant?.email)}
            </div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Account ID</div>
            <div style={{ color: textTokens.primary, fontWeight: 600, marginBottom: 10 }}>
              {valueOrDash(data?.tenant?.shortId)}
            </div>
            <div style={{ color: textTokens.muted, marginBottom: 4 }}>Tenant Role</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>tenant</div>
          </section>

          <section>
            <div style={sectionTitleStyle}>Security</div>
            <Link
              to="/forgot-password"
              style={{
                display: "inline-flex",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: textTokens.primary,
                fontWeight: 600,
              }}
            >
              Change password
            </Link>
          </section>

          <section>
            <div style={sectionTitleStyle}>Session</div>
            <button
              type="button"
              onClick={() => logoutTenant("/tenant/login")}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                background: colors.card,
                color: textTokens.primary,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          </section>

          <section>
            <div style={sectionTitleStyle}>Coming soon</div>
            <div style={{ color: textTokens.muted }}>
              Notification preferences and contact preferences will appear here.
            </div>
          </section>
        </>
      ) : null}
    </Card>
  );
}
