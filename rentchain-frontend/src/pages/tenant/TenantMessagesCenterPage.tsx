import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import {
  TenantCommunicationItem,
  getTenantMessages,
  markTenantMaintenanceUpdateRead,
  markTenantMessageRead,
  markTenantMessagesReadAll,
} from "../../api/tenantCommunicationsApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import { track } from "../../lib/analytics";

type FilterKey = "all" | "unread" | "message" | "maintenance_update";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "message", label: "Messages" },
  { key: "maintenance_update", label: "Maintenance" },
];

function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function bodyPreview(value: string): string {
  const clean = String(value || "").trim();
  if (!clean) return "No additional details.";
  return clean.length > 180 ? `${clean.slice(0, 179)}…` : clean;
}

function priorityTone(priority: TenantCommunicationItem["priority"]): string {
  if (priority === "high") return "#b91c1c";
  if (priority === "low") return "#1e40af";
  return "#334155";
}

function relatedLink(item: TenantCommunicationItem): string | null {
  if (item.relatedEntityType === "maintenance" && item.relatedEntityId) {
    return `/tenant/maintenance/${item.relatedEntityId}`;
  }
  return null;
}

export default function TenantMessagesCenterPage() {
  const [items, setItems] = useState<TenantCommunicationItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantMessages();
      const nextItems = Array.isArray(res?.items) ? res.items : [];
      setItems(nextItems);
      setSelectedId((prev) => (prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0]?.id || null));
      track("tenant.messages.opened", {
        count: Array.isArray(res?.items) ? res.items.length : 0,
        unreadCount: Number(res?.unreadCount || 0),
      });
    } catch (err: any) {
      setError(err?.message || "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((item) => !item.read);
    return items.filter((item) => item.type === filter);
  }, [filter, items]);

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  useEffect(() => {
    if (!filtered.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const markOneRead = async (item: TenantCommunicationItem) => {
    if (item.read) return;
    try {
      if (item.type === "message") {
        await markTenantMessageRead(item.id);
      } else if (item.type === "maintenance_update") {
        const requestId = item.relatedEntityId;
        if (!requestId) return;
        await markTenantMaintenanceUpdateRead(requestId);
      } else {
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
      track("tenant.message.read", { id: item.id, type: item.type });
    } catch {
      // Keep UX non-blocking; data refresh can reconcile later.
    }
  };

  const onSelect = (item: TenantCommunicationItem) => {
    setSelectedId(item.id);
    void markOneRead(item);
  };

  const markAll = async () => {
    if (!unreadCount || saving) return;
    setSaving(true);
    try {
      await markTenantMessagesReadAll();
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      track("tenant.messages.read_all", { count: unreadCount });
    } catch (err: any) {
      setError(err?.message || "Unable to mark messages as read.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevated style={{ padding: spacing.lg }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.sm,
          flexWrap: "wrap",
          marginBottom: spacing.md,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: textTokens.primary, fontSize: "1.4rem" }}>
Messages & Maintenance Updates
          </h1>
          <div style={{ marginTop: 6, color: textTokens.muted }}>
            Unread: <strong>{unreadCount}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={!unreadCount || saving}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            background: colors.panel,
            color: textTokens.primary,
            padding: "8px 12px",
            cursor: !unreadCount || saving ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Updating..." : "Mark all as read"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: spacing.md }}>
        {filters.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            style={{
              border: `1px solid ${filter === option.key ? "#bfdbfe" : colors.border}`,
              borderRadius: 999,
              padding: "6px 12px",
              background: filter === option.key ? "#dbeafe" : colors.card,
              color: filter === option.key ? "#1d4ed8" : textTokens.secondary,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div> : null}
      {loading ? (
        <div style={{ color: textTokens.muted }}>Loading messages…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: textTokens.muted }}>No messages or maintenance updates for this filter.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)",
            gap: spacing.md,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void onSelect(item)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${selected?.id === item.id ? "#bfdbfe" : colors.border}`,
                  borderRadius: 12,
                  background: selected?.id === item.id ? "#eff6ff" : colors.card,
                  padding: spacing.sm,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{item.title}</div>
                  {!item.read ? (
                    <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>Unread</span>
                  ) : (
                    <span style={{ fontSize: 11, color: textTokens.muted }}>Read</span>
                  )}
                </div>
                <div style={{ color: textTokens.muted, fontSize: "0.9rem", marginBottom: 6 }}>
                  {item.fromLabel} • {fmtDate(item.createdAt)}
                </div>
                <div style={{ color: textTokens.secondary, fontSize: "0.92rem" }}>{bodyPreview(item.body)}</div>
              </button>
            ))}
          </div>

          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              background: colors.card,
              padding: spacing.md,
              minHeight: 280,
            }}
          >
            {selected ? (
              <div style={{ display: "grid", gap: spacing.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem", color: textTokens.primary }}>
                      {selected.title}
                    </div>
                    <div style={{ color: textTokens.muted, marginTop: 4 }}>
                      {selected.fromLabel} • {fmtDate(selected.createdAt)}
                    </div>
                  </div>
                  <span
                    style={{
                      alignSelf: "start",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontWeight: 700,
                      fontSize: 12,
                      color: priorityTone(selected.priority),
                      background: colors.panel,
                    }}
                  >
                    {selected.priority}
                  </span>
                </div>
                <div style={{ color: textTokens.secondary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {selected.body || "No additional details."}
                </div>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  {!selected.read ? (
                    <button
                      type="button"
                      onClick={() => void markOneRead(selected)}
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
                  {relatedLink(selected) ? (
                    <Link
                      to={relatedLink(selected) || "#"}
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
                      Open related item
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ color: textTokens.muted }}>Select an item to view full details.</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}



