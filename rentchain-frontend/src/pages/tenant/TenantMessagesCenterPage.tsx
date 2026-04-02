import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Ui";
import {
  TenantCommunicationItem,
  getTenantMessages,
  markTenantMaintenanceUpdateRead,
  markTenantMessageRead,
  markTenantMessagesReadAll,
  markTenantScreeningUpdateRead,
} from "../../api/tenantCommunicationsApi";
import {
  TenantScreeningRequest,
  acceptTenantScreeningConsent,
  getTenantScreeningStatus,
  markTenantScreeningViewed,
  retryTenantScreening,
  startTenantScreening,
} from "../../api/tenantScreeningApi";
import { colors, spacing, text as textTokens } from "../../styles/tokens";
import { track } from "../../lib/analytics";

type FilterKey = "all" | "unread" | "message" | "maintenance_update" | "screening_update";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "message", label: "Messages" },
  { key: "maintenance_update", label: "Maintenance" },
  { key: "screening_update", label: "Screening" },
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

function screeningTone(status?: string | null) {
  switch (status) {
    case "completed":
      return { bg: "#dcfce7", color: "#166534", label: "Completed" };
    case "manual_review_required":
      return { bg: "#fef3c7", color: "#92400e", label: "Manual review" };
    case "failed":
      return { bg: "#fee2e2", color: "#991b1b", label: "Failed" };
    case "in_progress":
      return { bg: "#dbeafe", color: "#1d4ed8", label: "In progress" };
    case "consented":
      return { bg: "#e0f2fe", color: "#0369a1", label: "Ready to start" };
    case "consent_pending":
      return { bg: "#ede9fe", color: "#6d28d9", label: "Consent needed" };
    default:
      return { bg: "#e2e8f0", color: "#475569", label: "Requested" };
  }
}

function screeningProviderDisclosure(screening?: TenantScreeningRequest | null) {
  if (screening?.provider && screening.provider !== "manual") {
    return `RentChain may route this screening through ${screening.provider.replace(/_/g, " ")} once you continue.`;
  }
  return "RentChain may route this screening through a secure provider selected at runtime, or move it to manual review if no live provider is active.";
}

export default function TenantMessagesCenterPage() {
  const [items, setItems] = useState<TenantCommunicationItem[]>([]);
  const [screeningById, setScreeningById] = useState<Record<string, TenantScreeningRequest>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screeningSaving, setScreeningSaving] = useState(false);
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
  const selectedScreening =
    selected?.relatedEntityType === "screening" && selected.relatedEntityId
      ? screeningById[selected.relatedEntityId] || null
      : null;

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
      } else if (item.type === "screening_update") {
        const requestId = item.relatedEntityId;
        if (!requestId) return;
        await markTenantScreeningUpdateRead(requestId);
      } else {
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
      track("tenant.message.read", { id: item.id, type: item.type });
    } catch {
      // Keep UX non-blocking; data refresh can reconcile later.
    }
  };

  const loadScreening = React.useCallback(async (requestId: string) => {
    const res = await getTenantScreeningStatus(requestId);
    if (res?.screeningRequest) {
      setScreeningById((prev) => ({ ...prev, [requestId]: res.screeningRequest }));
      return res.screeningRequest;
    }
    return null;
  }, []);

  const onSelect = (item: TenantCommunicationItem) => {
    setSelectedId(item.id);
    void markOneRead(item);
    if (item.relatedEntityType === "screening" && item.relatedEntityId) {
      void loadScreening(item.relatedEntityId).then((screening) => {
        if (!screening?.consent?.viewedAt && screening.status === "consent_pending") {
          void markTenantScreeningViewed(item.relatedEntityId as string, {
            providerDisclosure: screeningProviderDisclosure(screening),
            disclosureVersion: "screening-consent-v1",
          })
            .then((res) => {
              if (res?.screeningRequest) {
                setScreeningById((prev) => ({ ...prev, [item.relatedEntityId as string]: res.screeningRequest }));
              }
            })
            .catch(() => {
              // keep panel usable even if view logging fails
            });
        }
      });
    }
  };

  const runScreeningAction = async (action: "consent" | "start" | "retry") => {
    if (!selected?.relatedEntityId) return;
    setScreeningSaving(true);
    setError(null);
    try {
      const requestId = selected.relatedEntityId;
      const response =
        action === "consent"
          ? await acceptTenantScreeningConsent(requestId, {
              providerDisclosure: screeningProviderDisclosure(selectedScreening),
              disclosureVersion: "screening-consent-v1",
            })
          : action === "start"
          ? await startTenantScreening(requestId)
          : await retryTenantScreening(requestId);
      if (response?.screeningRequest) {
        setScreeningById((prev) => ({ ...prev, [requestId]: response.screeningRequest }));
      } else {
        await loadScreening(requestId);
      }
      await load();
    } catch (err: any) {
      setError(err?.message || "Unable to update screening.");
    } finally {
      setScreeningSaving(false);
    }
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
            Messages, Maintenance & Screening
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
        <div style={{ color: textTokens.muted }}>No messages, maintenance updates, or screening actions for this filter.</div>
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
                {selected.type === "screening_update" && selected.relatedEntityId ? (
                  selectedScreening ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        background: colors.panel,
                        padding: spacing.sm,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 700, color: textTokens.primary }}>Screening summary</div>
                          <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                            {selectedScreening.applicantName || "Applicant"}
                            {selectedScreening.propertyLabel ? ` • ${selectedScreening.propertyLabel}` : ""}
                            {selectedScreening.unitLabel ? ` • Unit ${selectedScreening.unitLabel}` : ""}
                          </div>
                        </div>
                        <span
                          style={{
                            alignSelf: "start",
                            borderRadius: 999,
                            padding: "4px 8px",
                            fontWeight: 700,
                            fontSize: 12,
                            background: screeningTone(selectedScreening.status).bg,
                            color: screeningTone(selectedScreening.status).color,
                          }}
                        >
                          {screeningTone(selectedScreening.status).label}
                        </span>
                      </div>
                      <div style={{ display: "grid", gap: 6, color: textTokens.secondary, fontSize: "0.92rem" }}>
                        <div>Package: {selectedScreening.packageType || "standard"}</div>
                        <div>Provider: {selectedScreening.provider ? selectedScreening.provider.replace(/_/g, " ") : "runtime selected"}</div>
                        <div>Requested: {selectedScreening.requestedAt ? fmtDate(new Date(selectedScreening.requestedAt).toISOString()) : "—"}</div>
                        <div>{selectedScreening.summary.summaryResult}</div>
                      </div>
                      <div
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          background: colors.card,
                          padding: "10px 12px",
                          color: textTokens.secondary,
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: textTokens.primary, marginBottom: 6 }}>Consent disclosure</div>
                        <div>
                          RentChain will not start screening until you accept consent. {screeningProviderDisclosure(selectedScreening)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                        {selectedScreening.status === "consent_pending" ? (
                          <button
                            type="button"
                            onClick={() => void runScreeningAction("consent")}
                            disabled={screeningSaving}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: "#dbeafe",
                              color: "#1d4ed8",
                              padding: "8px 12px",
                              cursor: screeningSaving ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {screeningSaving ? "Saving..." : "Accept consent"}
                          </button>
                        ) : null}
                        {(selectedScreening.status === "consented" || selectedScreening.status === "requested") && !selectedScreening.session ? (
                          <button
                            type="button"
                            onClick={() => void runScreeningAction("start")}
                            disabled={screeningSaving}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: "#dcfce7",
                              color: "#166534",
                              padding: "8px 12px",
                              cursor: screeningSaving ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {screeningSaving ? "Starting..." : "Start screening"}
                          </button>
                        ) : null}
                        {(selectedScreening.status === "failed" || selectedScreening.status === "manual_review_required") ? (
                          <button
                            type="button"
                            onClick={() => void runScreeningAction("retry")}
                            disabled={screeningSaving}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: colors.card,
                              color: textTokens.primary,
                              padding: "8px 12px",
                              cursor: screeningSaving ? "not-allowed" : "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {screeningSaving ? "Retrying..." : "Retry screening"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: textTokens.muted }}>Loading screening details…</div>
                  )
                ) : null}
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



