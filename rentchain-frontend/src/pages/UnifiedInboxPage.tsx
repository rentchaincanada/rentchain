import React from "react";
import { RefreshCcw, Search } from "lucide-react";
import {
  fetchUnifiedInbox,
  type UnifiedInboxPriority,
  type UnifiedInboxRecord,
  type UnifiedInboxResponse,
  type UnifiedInboxRole,
  type UnifiedInboxStatus,
} from "../api/unifiedInboxApi";
import { UnifiedInboxList } from "../components/UnifiedInbox/UnifiedInboxList";
import { Button, Card } from "../components/ui/Ui";
import { colors, radius, spacing, text } from "../styles/tokens";

type Props = {
  role: UnifiedInboxRole;
};

function titleForRole(role: UnifiedInboxRole) {
  if (role === "tenant") return "Tenant inbox";
  if (role === "contractor") return "Contractor inbox";
  return "Unified inbox";
}

function subtitleForRole(role: UnifiedInboxRole) {
  if (role === "tenant") {
    return "Tenant updates organized by priority, status, and workflow area.";
  }
  if (role === "contractor") {
    return "Work orders and messages organized for quick follow-up.";
  }
  return "Operational messages organized by priority, status, and workspace.";
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load the unified inbox.";
}

type InboxTab = "all" | "unread" | "priority" | "maintenance" | "lease" | "payments" | "system";
type StatusFilter = "all" | UnifiedInboxStatus;
type PriorityFilter = "all" | UnifiedInboxPriority;

const TABS: Array<{ id: InboxTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "priority", label: "Priority" },
  { id: "maintenance", label: "Maintenance" },
  { id: "lease", label: "Lease" },
  { id: "payments", label: "Payments" },
  { id: "system", label: "System" },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function recordText(record: UnifiedInboxRecord) {
  return `${record.title} ${record.body} ${record.sourceKind} ${record.priority} ${record.status}`;
}

function isPaymentRecord(record: UnifiedInboxRecord) {
  return /\b(payment|payments|rent|invoice|charge|balance|outstanding|collection)\b/i.test(recordText(record));
}

function isRecordInTab(record: UnifiedInboxRecord, tab: InboxTab) {
  if (tab === "all") return true;
  if (tab === "unread") return record.status === "unread";
  if (tab === "priority") return record.priority === "critical" || record.priority === "high";
  if (tab === "maintenance") return record.sourceKind.includes("maintenance") || record.sourceKind.includes("work_order");
  if (tab === "lease") return record.sourceKind.includes("lease");
  if (tab === "payments") return isPaymentRecord(record);
  if (tab === "system") return record.sourceKind.includes("notice");
  return true;
}

function statusLabel(value: StatusFilter) {
  if (value === "all") return "All statuses";
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function priorityLabel(value: PriorityFilter) {
  if (value === "all") return "All priorities";
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function UnifiedInboxPage({ role }: Props) {
  const [data, setData] = React.useState<UnifiedInboxResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<InboxTab>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("all");
  const [search, setSearch] = React.useState("");
  const [localReadAtById, setLocalReadAtById] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUnifiedInbox(role);
      setData(response);
    } catch (err) {
      setError(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setLocalReadAtById({});
  }, [role]);

  const records = data?.records || data?.items || [];
  const safeRecords = React.useMemo(
    () =>
      records
        .filter((record) => record.audienceRole === role)
        .map((record) => {
          const localReadAt = localReadAtById[record.id];
          if (!localReadAt) return record;
          return { ...record, status: "read" as const, readAt: localReadAt };
        }),
    [localReadAtById, records, role]
  );
  const normalizedSearch = normalize(search);
  const filteredRecords = React.useMemo(
    () =>
      safeRecords.filter((record) => {
        const matchesTab = isRecordInTab(record, activeTab);
        const matchesStatus = statusFilter === "all" || record.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || record.priority === priorityFilter;
        const matchesSearch = !normalizedSearch || normalize(recordText(record)).includes(normalizedSearch);
        return matchesTab && matchesStatus && matchesPriority && matchesSearch;
      }),
    [activeTab, normalizedSearch, priorityFilter, safeRecords, statusFilter]
  );
  const unreadCount = safeRecords.filter((record) => record.status === "unread").length;
  const priorityCount = safeRecords.filter((record) => record.priority === "critical" || record.priority === "high").length;
  const markRecordRead = React.useCallback((record: UnifiedInboxRecord) => {
    if (record.status !== "unread" && record.readAt) return;
    setLocalReadAtById((current) => {
      if (current[record.id]) return current;
      return { ...current, [record.id]: new Date().toISOString() };
    });
  }, []);

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <Card elevated style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <h1 style={{ margin: 0, color: text.primary, fontSize: "1.55rem" }}>{titleForRole(role)}</h1>
          <div style={{ color: text.muted, lineHeight: 1.55 }}>{subtitleForRole(role)}</div>
        </div>
        <Button type="button" variant="ghost" onClick={() => void load()} disabled={loading} style={{ alignSelf: "flex-start" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </span>
        </Button>
      </Card>

      {loading ? (
        <Card elevated style={{ color: text.muted }}>
          Loading inbox updates...
        </Card>
      ) : null}

      {!loading && error ? (
        <Card elevated style={{ borderColor: colors.danger, color: colors.danger, display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 800 }}>We couldn't load this inbox.</div>
          <div>{error}</div>
          <Button type="button" variant="ghost" onClick={() => void load()} style={{ justifySelf: "start" }}>
            Try again
          </Button>
        </Card>
      ) : null}

      {!loading && !error ? (
        <>
          <Card style={{ display: "grid", gap: spacing.md }}>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }} role="tablist" aria-label="Inbox views">
              {TABS.map((tab) => {
                const selected = activeTab === tab.id;
                const count = safeRecords.filter((record) => isRecordInTab(record, tab.id)).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${tab.label} ${count}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      border: selected ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                      borderRadius: 999,
                      background: selected ? "#eff6ff" : colors.card,
                      color: selected ? colors.accent : text.secondary,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 800,
                      minHeight: 38,
                      padding: "8px 12px",
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{ color: selected ? colors.accent : text.subtle, fontSize: 12 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: "grid",
                gap: spacing.sm,
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              }}
            >
              <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.86rem", fontWeight: 800 }}>
                Search
                <span style={{ position: "relative", display: "block" }}>
                  <Search
                    size={16}
                    aria-hidden="true"
                    style={{ color: text.subtle, left: 12, position: "absolute", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search messages"
                    aria-label="Search inbox"
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      color: text.primary,
                      minHeight: 42,
                      padding: "9px 12px 9px 36px",
                      width: "100%",
                    }}
                  />
                </span>
              </label>

              <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.86rem", fontWeight: 800 }}>
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  aria-label="Filter inbox status"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    color: text.primary,
                    minHeight: 42,
                    padding: "9px 12px",
                    width: "100%",
                  }}
                >
                  {(["all", "unread", "read", "resolved", "muted", "archived"] as StatusFilter[]).map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.86rem", fontWeight: 800 }}>
                Priority
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                  aria-label="Filter inbox priority"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    color: text.primary,
                    minHeight: 42,
                    padding: "9px 12px",
                    width: "100%",
                  }}
                >
                  {(["all", "critical", "high", "normal", "low"] as PriorityFilter[]).map((value) => (
                    <option key={value} value={value}>
                      {priorityLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", color: text.muted, fontSize: "0.92rem" }}>
              <span>
                Showing <strong style={{ color: text.primary }}>{filteredRecords.length}</strong> of {safeRecords.length}
              </span>
              <span>
                Unread <strong style={{ color: text.primary }}>{unreadCount}</strong>
              </span>
              <span>
                Priority <strong style={{ color: text.primary }}>{priorityCount}</strong>
              </span>
            </div>
          </Card>
          <UnifiedInboxList records={filteredRecords} role={role} onOpenRecord={markRecordRead} />
        </>
      ) : null}
    </div>
  );
}
