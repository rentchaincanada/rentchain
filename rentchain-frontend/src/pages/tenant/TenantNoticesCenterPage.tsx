import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import {
  TenantCommunicationItem,
  getTenantNoticesCenter,
  markTenantNoticeRead,
} from "../../api/tenantCommunicationsApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import { track } from "../../lib/analytics";

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toCategory(item: TenantCommunicationItem): string {
  if (item.priority === "high") return "Important";
  return "General";
}

export default function TenantNoticesCenterPage() {
  const [items, setItems] = useState<TenantCommunicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantNoticesCenter();
      const notices = Array.isArray(res?.items) ? res.items.filter((item) => item.type === "notice") : [];
      setItems(notices);
      track("tenant.notices.opened", {
        count: notices.length,
        unreadCount: notices.filter((item) => !item.read).length,
      });
    } catch (err: any) {
      setError(err?.message || "Unable to load notices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const onMarkRead = async (item: TenantCommunicationItem) => {
    if (item.read) return;
    try {
      await markTenantNoticeRead(item.id);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
      track("tenant.notice.read", { id: item.id });
    } catch {
      // leave stale state if call fails; refresh will reconcile.
    }
  };

  return (
    <Card elevated style={{ padding: spacing.lg }}>
      <div
        style={{
          marginBottom: spacing.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>Notices Center</h1>
          <div style={{ marginTop: 6, color: textTokens.muted }}>
            Formal notices and important landlord announcements.
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 999,
            padding: "6px 10px",
            background: colors.panel,
            fontWeight: 700,
            color: textTokens.secondary,
          }}
        >
          Unread: {unreadCount}
        </div>
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}
      {loading ? (
        <div style={{ color: textTokens.muted }}>Loading notices…</div>
      ) : items.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No notices are available right now.</div>
      ) : (
        <div style={{ display: "grid", gap: spacing.sm }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                background: colors.card,
                padding: spacing.sm,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
                  <div style={{ marginTop: 3, color: textTokens.muted, fontSize: "0.9rem" }}>
                    {toCategory(item)} • {fmtDate(item.createdAt)}
                  </div>
                </div>
                <span
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 999,
                    padding: "3px 8px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: item.read ? textTokens.muted : "#1d4ed8",
                    background: item.read ? colors.panel : "#eff6ff",
                  }}
                >
                  {item.read ? "Read" : "Unread"}
                </span>
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {item.body || "No additional details."}
              </div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                {!item.read ? (
                  <button
                    type="button"
                    onClick={() => void onMarkRead(item)}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      background: colors.panel,
                      color: textTokens.primary,
                      padding: "7px 11px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Mark as read
                  </button>
                ) : null}
                <Link
                  to={`/tenant/notices/${item.id}`}
                  onClick={() => void onMarkRead(item)}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    background: colors.card,
                    color: textTokens.primary,
                    padding: "7px 11px",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Open full notice
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
