import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTenantMaintenanceRequest, MaintenanceRequest } from "../../api/tenantMaintenanceApi";
import { Card, Section } from "../../components/ui/Ui";
import { clearTenantToken, getTenantToken } from "../../lib/tenantAuth";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(ts?: number | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default function TenantMaintenanceRequestDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(() =>
    typeof window === "undefined" ? true : !!getTenantToken()
  );

  useEffect(() => {
    const token = getTenantToken();
    if (!token && typeof window !== "undefined") {
      setHasToken(false);
      setSessionExpired(true);
      setData(null);
      setError(null);
      return;
    }
    setHasToken(true);
    const load = async () => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);
      try {
        const res = await getTenantMaintenanceRequest(id || "");
        setData(res.data);
      } catch (err: any) {
        if (err?.payload?.error === "UNAUTHORIZED" || err?.status === 401) {
          setSessionExpired(true);
          setData(null);
          setError(null);
        } else {
          const msg = err?.payload?.error || err?.message || "Unable to load request";
          setError(String(msg));
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (!hasToken || sessionExpired) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.bgAmbient,
          padding: spacing.xl,
          boxSizing: "border-box",
        }}
      >
        <Section style={{ maxWidth: 900, margin: "0 auto" }}>
          <Card elevated style={{ borderColor: colors.borderStrong, background: "#fff7ed", color: "#9a3412" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Your session expired. Please sign in again.</div>
            <div style={{ marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const next = encodeURIComponent(window.location.pathname + (window.location.search || ""));
                    window.location.href = `/tenant/login?next=${next}`;
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Sign in
              </button>
            </div>
          </Card>
        </Section>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bgAmbient,
        padding: spacing.xl,
        boxSizing: "border-box",
      }}
    >
      <Section style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: textTokens.primary }}>Maintenance request</div>
            <div style={{ color: textTokens.muted }}>View details of your request</div>
          </div>
          <a
            href="/tenant"
            style={{
              padding: "8px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              textDecoration: "none",
              color: textTokens.primary,
              fontWeight: 700,
            }}
          >
            Back to dashboard
          </a>
        </div>

        {error ? (
          <Card elevated style={{ borderColor: colors.borderStrong, color: colors.danger }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Unable to load request</div>
            <div style={{ fontSize: "0.95rem" }}>{error}</div>
            <div style={{ marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={() => {
                  clearTenantToken();
                  if (typeof window !== "undefined") window.location.href = "/tenant/login";
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Return to login
              </button>
            </div>
          </Card>
        ) : loading ? (
          <Card elevated>
            <div style={{ height: 16, background: colors.accentSoft, borderRadius: 6, width: "50%", marginBottom: 10 }} />
            <div style={{ height: 12, background: colors.accentSoft, borderRadius: 6, width: "30%", marginBottom: 8 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "100%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "90%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "80%" }} />
          </Card>
        ) : data ? (
          <Card elevated>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: textTokens.primary }}>{data.title}</div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", color: textTokens.muted, fontSize: "0.95rem" }}>
                <span>Status: {data.status}</span>
                <span>Priority: {data.priority}</span>
                <span>Category: {data.category}</span>
              </div>
              <div style={{ color: textTokens.muted, fontSize: "0.95rem" }}>
                Created {fmtDate(data.createdAt)} • Updated {fmtDate(data.updatedAt)}
              </div>
              <div style={{ color: textTokens.primary, fontSize: "1rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {data.description}
              </div>
            </div>
          </Card>
        ) : null}
      </Section>
    </div>
  );
}
