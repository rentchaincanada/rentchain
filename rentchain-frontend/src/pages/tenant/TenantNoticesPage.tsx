import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTenantNotices, TenantNoticeSummary } from "../../api/tenantNoticesApi";
import { Card } from "../../components/ui/Ui";
import { colors, spacing, text as textTokens } from "../../styles/tokens";

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export default function TenantNoticesPage() {
  const [items, setItems] = useState<TenantNoticeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantNotices();
        if (!cancelled) setItems(Array.isArray(res?.data) ? res.data : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Unable to load notices.");
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
        <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Notices</h1>
        <div style={{ marginTop: 6, color: textTokens.muted }}>
          Official notices shared by your landlord.
        </div>
      </div>

      {error ? (
        <div style={{ color: colors.danger }}>{error}</div>
      ) : loading ? (
        <div style={{ color: textTokens.muted }}>Loading notices…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No notices available yet.</div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((notice) => (
            <Link
              key={notice.id}
              to={`/tenant/notices/${notice.id}`}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                background: colors.card,
                padding: spacing.sm,
                textDecoration: "none",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>{notice.title}</div>
              <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                {formatNoticeType(notice.type)} • {fmtDate(notice.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
