import React, { useEffect, useState } from "react";
import { tenantApiFetch } from "../../api/tenantApiFetch";
import { Card } from "../../components/ui/Ui";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

type TenantMeResponse = {
  ok: boolean;
  data?: {
    tenant?: {
      name?: string | null;
      email?: string | null;
      shortId?: string | null;
    };
    property?: { name?: string | null };
    unit?: { label?: string | null };
    lease?: { startDate?: number | null; endDate?: number | null };
  };
};

function fmtDate(ts?: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function valueOrDash(value?: string | null): string {
  const trimmed = String(value || "").trim();
  return trimmed || "—";
}

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "200px 1fr",
  gap: spacing.sm,
  padding: `${spacing.xs} 0`,
  borderBottom: `1px solid ${colors.border}`,
};

export default function TenantProfilePage() {
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
        if (!cancelled) setError(err?.message || "Unable to load profile information.");
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
    <Card elevated style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.md }}>
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Profile Information</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Account and lease details for your tenant profile.
        </div>
      </div>

      {error ? (
        <div style={{ color: colors.danger }}>{error}</div>
      ) : loading ? (
        <div style={{ color: textTokens.muted }}>Loading profile…</div>
      ) : (
        <div style={{ display: "grid", gap: 0 }}>
          <div style={rowStyle}>
            <div style={{ color: textTokens.muted }}>Full Name</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{valueOrDash(data?.tenant?.name)}</div>
          </div>
          <div style={rowStyle}>
            <div style={{ color: textTokens.muted }}>Email</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{valueOrDash(data?.tenant?.email)}</div>
          </div>
          <div style={rowStyle}>
            <div style={{ color: textTokens.muted }}>Lease Property</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{valueOrDash(data?.property?.name)}</div>
          </div>
          <div style={rowStyle}>
            <div style={{ color: textTokens.muted }}>Unit</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{valueOrDash(data?.unit?.label)}</div>
          </div>
          <div style={rowStyle}>
            <div style={{ color: textTokens.muted }}>Lease Start</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{fmtDate(data?.lease?.startDate)}</div>
          </div>
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <div style={{ color: textTokens.muted }}>Lease End</div>
            <div style={{ color: textTokens.primary, fontWeight: 600 }}>{fmtDate(data?.lease?.endDate)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: spacing.md }}>
        <button
          type="button"
          disabled
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            background: colors.panel,
            color: textTokens.muted,
            padding: "8px 12px",
            cursor: "not-allowed",
            fontWeight: 600,
          }}
        >
          Edit Profile (Coming soon)
        </button>
      </div>
    </Card>
  );
}
