import React from "react";
import { RefreshCcw, Search } from "lucide-react";
import {
  fetchUnifiedInbox,
  markUnifiedInboxRecordRead,
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

const landlordInboxTheme = {
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  panel: "#fbf6ed",
  border: "rgba(91, 70, 48, 0.16)",
  borderStrong: "rgba(91, 70, 48, 0.3)",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
  shadow: "0 12px 28px rgba(59, 44, 28, 0.1)",
};

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
  const [readError, setReadError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<InboxTab>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("all");
  const [search, setSearch] = React.useState("");
  const [localReadAtById, setLocalReadAtById] = React.useState<Record<string, string>>({});
  const [openedRecordId, setOpenedRecordId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setReadError(null);
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
    setOpenedRecordId(null);
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
  const displayedRecords = React.useMemo(() => {
    if (!openedRecordId || filteredRecords.some((record) => record.id === openedRecordId)) {
      return filteredRecords;
    }
    const openedRecord = safeRecords.find((record) => record.id === openedRecordId);
    if (!openedRecord) return filteredRecords;
    return [openedRecord, ...filteredRecords];
  }, [filteredRecords, openedRecordId, safeRecords]);
  const unreadCount = safeRecords.filter((record) => record.status === "unread").length;
  const priorityCount = safeRecords.filter((record) => record.priority === "critical" || record.priority === "high").length;
  const isLandlord = role === "landlord";
  const markRecordRead = React.useCallback(
    async (record: UnifiedInboxRecord) => {
      setOpenedRecordId(record.id);
      if (record.status !== "unread" && record.readAt) return;
      if (localReadAtById[record.id]) return;
      if (role !== "landlord") {
        setLocalReadAtById((current) => ({ ...current, [record.id]: new Date().toISOString() }));
        return;
      }
      try {
        setReadError(null);
        const response = await markUnifiedInboxRecordRead(role, record.id);
        const readAt = response.record.readAt || new Date().toISOString();
        setLocalReadAtById((current) => ({ ...current, [record.id]: readAt }));
      } catch (err) {
        setReadError(errorMessage(err));
      }
    },
    [localReadAtById, role]
  );
  const resetFilterContext = React.useCallback(() => {
    setOpenedRecordId(null);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gap: spacing.md,
        margin: "0 auto",
        maxWidth: 1320,
        width: "calc(100% - 32px)",
      }}
    >
      <Card
        elevated
        style={{
          background: isLandlord ? landlordInboxTheme.card : undefined,
          borderColor: isLandlord ? landlordInboxTheme.border : undefined,
          boxShadow: isLandlord ? landlordInboxTheme.shadow : undefined,
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <h1 style={{ margin: 0, color: text.primary, fontSize: "1.55rem" }}>{titleForRole(role)}</h1>
          <div style={{ color: text.muted, lineHeight: 1.55 }}>{subtitleForRole(role)}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void load()}
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            background: isLandlord ? landlordInboxTheme.cardStrong : undefined,
            borderColor: isLandlord ? landlordInboxTheme.borderStrong : undefined,
            color: isLandlord ? "#211c17" : undefined,
          }}
        >
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
          {readError ? (
            <Card elevated style={{ borderColor: colors.borderStrong, color: text.secondary, display: "grid", gap: spacing.xs }}>
              <div style={{ color: text.primary, fontWeight: 800 }}>Read status was not saved.</div>
              <div>{readError}</div>
            </Card>
          ) : null}

          <Card
            style={{
              background: isLandlord ? landlordInboxTheme.card : undefined,
              borderColor: isLandlord ? landlordInboxTheme.border : undefined,
              boxShadow: isLandlord ? landlordInboxTheme.shadow : undefined,
              display: "grid",
              gap: spacing.md,
            }}
          >
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
                    onClick={() => {
                      resetFilterContext();
                      setActiveTab(tab.id);
                    }}
                    style={{
                      border: selected
                        ? `1px solid ${isLandlord ? landlordInboxTheme.borderStrong : colors.accent}`
                        : `1px solid ${isLandlord ? landlordInboxTheme.border : colors.border}`,
                      borderRadius: 999,
                      background: selected ? (isLandlord ? landlordInboxTheme.pineSoft : "#eff6ff") : isLandlord ? landlordInboxTheme.card : colors.card,
                      color: selected ? (isLandlord ? landlordInboxTheme.pine : colors.accent) : text.secondary,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 800,
                      minHeight: 38,
                      outline: selected && isLandlord ? "2px solid rgba(36, 88, 66, 0.18)" : undefined,
                      outlineOffset: selected && isLandlord ? 2 : undefined,
                      padding: "8px 12px",
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{ color: selected ? (isLandlord ? landlordInboxTheme.pine : colors.accent) : text.subtle, fontSize: 12 }}>{count}</span>
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
                    onChange={(event) => {
                      resetFilterContext();
                      setSearch(event.target.value);
                    }}
                    placeholder="Search messages"
                    aria-label="Search inbox"
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      color: text.primary,
                      background: isLandlord ? landlordInboxTheme.cardStrong : undefined,
                      borderColor: isLandlord ? landlordInboxTheme.borderStrong : colors.border,
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
                  onChange={(event) => {
                    resetFilterContext();
                    setStatusFilter(event.target.value as StatusFilter);
                  }}
                  aria-label="Filter inbox status"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    color: text.primary,
                    background: isLandlord ? landlordInboxTheme.cardStrong : undefined,
                    borderColor: isLandlord ? landlordInboxTheme.borderStrong : colors.border,
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
                  onChange={(event) => {
                    resetFilterContext();
                    setPriorityFilter(event.target.value as PriorityFilter);
                  }}
                  aria-label="Filter inbox priority"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    color: text.primary,
                    background: isLandlord ? landlordInboxTheme.cardStrong : undefined,
                    borderColor: isLandlord ? landlordInboxTheme.borderStrong : colors.border,
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

            <div
              style={{
                background: isLandlord ? landlordInboxTheme.panel : undefined,
                border: isLandlord ? `1px solid ${landlordInboxTheme.border}` : undefined,
                borderRadius: isLandlord ? radius.md : undefined,
                color: text.muted,
                display: "flex",
                flexWrap: "wrap",
                fontSize: "0.92rem",
                gap: spacing.md,
                padding: isLandlord ? "10px 12px" : undefined,
              }}
            >
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
          <UnifiedInboxList records={displayedRecords} role={role} onOpenRecord={markRecordRead} />
        </>
      ) : null}
    </div>
  );
}
