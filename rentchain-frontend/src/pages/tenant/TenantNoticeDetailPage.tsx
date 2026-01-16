import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTenantNotice, TenantNoticeDetail } from "../../api/tenantNoticesApi";
import { Card, Section } from "../../components/ui/Ui";
import { clearTenantToken, getTenantToken } from "../../lib/tenantAuth";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function formatNoticeType(type?: string | null): string {
  switch ((type || "").toUpperCase()) {
    case "LATE_RENT":
      return "Late rent";
    case "ENTRY_NOTICE":
      return "Entry notice";
    case "LEASE_UPDATE":
      return "Lease update";
    case "WARNING":
      return "Warning";
    case "GENERAL":
    default:
      return "Notice";
  }
}

export default function TenantNoticeDetailPage() {
  const params = useParams();
  const noticeId = params.noticeId || "";
  const [notice, setNotice] = useState<TenantNoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = getTenantToken();
    if (!token && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + (window.location.search || ""));
      window.location.replace(`/tenant/login?next=${next}`);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);
      try {
        const res = await getTenantNotice(noticeId);
        setNotice(res.data);
      } catch (err: any) {
        if (err?.payload?.error === "UNAUTHORIZED" || err?.status === 401) {
          setSessionExpired(true);
        } else {
          const msg = err?.payload?.error || err?.message || "Unable to load notice";
          setError(String(msg));
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [noticeId]);

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
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: textTokens.primary }}>Notice</div>
            <div style={{ color: textTokens.muted }}>Official communication from your landlord</div>
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

        {sessionExpired ? (
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
        ) : error ? (
          <Card elevated style={{ borderColor: colors.borderStrong, color: colors.danger }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Unable to load notice</div>
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
            <div style={{ height: 16, background: colors.accentSoft, borderRadius: 6, width: "40%", marginBottom: 10 }} />
            <div style={{ height: 12, background: colors.accentSoft, borderRadius: 6, width: "25%", marginBottom: 8 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "100%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "90%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "80%" }} />
          </Card>
        ) : notice ? (
          <Card elevated>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: textTokens.primary }}>{notice.title}</div>
                <div style={{ color: textTokens.muted, fontSize: "0.95rem" }}>{formatNoticeType(notice.type)}</div>
              </div>
              <div style={{ color: textTokens.secondary, fontSize: "0.95rem" }}>
                Created {fmtDate(notice.createdAt)}
                {notice.effectiveAt ? ` • Effective ${fmtDate(notice.effectiveAt)}` : ""}
              </div>
              <div style={{ color: textTokens.primary, fontSize: "1rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {notice.body || "No additional details provided."}
              </div>
            </div>
          </Card>
        ) : null}
      </Section>
    </div>
  );
}
