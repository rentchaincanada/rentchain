import React from "react";
import { ArrowUpRight, ChevronRight, Inbox } from "lucide-react";
import type { UnifiedInboxRecord, UnifiedInboxRole, UnifiedInboxSourceKind } from "../../api/unifiedInboxApi";
import { Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type Props = {
  records: UnifiedInboxRecord[];
  role: UnifiedInboxRole;
};

const SOURCE_LABELS: Record<UnifiedInboxSourceKind, string> = {
  "tenant.message": "Message",
  "tenant.maintenance": "Maintenance",
  "tenant.screening": "Screening",
  "tenant.lease": "Lease",
  "tenant.application": "Application",
  "tenant.notice": "Notice",
  "tenant.viewing": "Viewing",
  "landlord.application": "Application",
  "landlord.screening": "Screening",
  "landlord.lease": "Lease",
  "landlord.maintenance": "Maintenance",
  "landlord.message": "Message",
  "landlord.notice": "Notice",
  "landlord.viewing": "Viewing",
  "landlord.work_order": "Work order",
  "contractor.work_order": "Work order",
  "contractor.message": "Message",
};

function roleTitle(role: UnifiedInboxRole) {
  if (role === "tenant") return "Tenant inbox";
  if (role === "contractor") return "Contractor inbox";
  return "Landlord inbox";
}

function statusTone(status: UnifiedInboxRecord["status"]) {
  if (status === "resolved") return { color: "#166534", background: "#dcfce7" };
  if (status === "archived" || status === "muted") return { color: "#475569", background: "#f1f5f9" };
  if (status === "read") return { color: "#1d4ed8", background: "#dbeafe" };
  return { color: "#9a3412", background: "#ffedd5" };
}

function priorityTone(priority: UnifiedInboxRecord["priority"]) {
  if (priority === "critical" || priority === "high") return { color: "#991b1b", background: "#fee2e2" };
  if (priority === "low") return { color: "#475569", background: "#f1f5f9" };
  return { color: "#075985", background: "#e0f2fe" };
}

function workspaceForRecord(record: UnifiedInboxRecord, role: UnifiedInboxRole) {
  if (role === "tenant") return null;
  if (role === "contractor") return null;
  if (record.sourceKind.includes("maintenance") || record.sourceKind.includes("work_order")) {
    return { href: "/work-orders", label: "Open work orders" };
  }
  if (record.sourceKind.includes("lease")) {
    return { href: "/leases", label: "Open leases" };
  }
  if (record.sourceKind.includes("application") || record.sourceKind.includes("screening") || record.sourceKind.includes("viewing")) {
    return { href: "/applications", label: "Open applications" };
  }
  if (/\b(payment|payments|rent|invoice|charge|balance|outstanding|collection)\b/i.test(record.title + " " + record.body)) {
    return { href: "/payments", label: "Open payments" };
  }
  if (record.sourceKind.includes("message")) {
    return { href: "/landlord/unified-inbox", label: "Stay in inbox" };
  }
  return null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function isSafeRecordForRole(record: UnifiedInboxRecord, role: UnifiedInboxRole) {
  return record.audienceRole === role;
}

export function UnifiedInboxList({ records, role }: Props) {
  const safeRecords = records.filter((record) => isSafeRecordForRole(record, role));
  const [selectedId, setSelectedId] = React.useState<string | null>(safeRecords[0]?.id || null);
  const selected = safeRecords.find((record) => record.id === selectedId) || safeRecords[0] || null;
  const selectedWorkspace = selected ? workspaceForRecord(selected, role) : null;

  React.useEffect(() => {
    if (!safeRecords.length) {
      setSelectedId(null);
      return;
    }
    if (!safeRecords.some((record) => record.id === selectedId)) {
      setSelectedId(safeRecords[0].id);
    }
  }, [safeRecords, selectedId]);

  if (!safeRecords.length) {
    return (
      <Card elevated style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: text.primary, fontWeight: 800 }}>
          <Inbox size={20} />
          No inbox updates
        </div>
        <div style={{ color: text.muted }}>
          {roleTitle(role)} updates will appear here when there is activity available for this workspace.
        </div>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: spacing.sm }}>
        {safeRecords.map((record) => {
          const active = record.id === selected?.id;
          const priority = priorityTone(record.priority);
          const status = statusTone(record.status);
          return (
            <button
              key={record.id}
              type="button"
              onClick={() => setSelectedId(record.id)}
              aria-current={active ? "true" : undefined}
              style={{
                textAlign: "left",
                border: active ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                borderRadius: radius.md,
                background: active ? "#eff6ff" : colors.card,
                color: text.primary,
                padding: spacing.md,
                display: "grid",
                gap: spacing.sm,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>{record.title}</div>
                  <div style={{ color: text.muted, fontSize: "0.9rem" }}>{SOURCE_LABELS[record.sourceKind]}</div>
                </div>
                <ChevronRight size={18} aria-hidden="true" />
              </div>
              <div style={{ color: text.secondary, lineHeight: 1.5 }}>{record.body}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ ...priority, borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 800 }}>
                  {formatStatus(record.priority)}
                </span>
                <span style={{ ...status, borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 800 }}>
                  {formatStatus(record.status)}
                </span>
                <span style={{ color: text.subtle, fontSize: 12 }}>{formatDate(record.occurredAt)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <Card elevated style={{ alignSelf: "start", display: "grid", gap: spacing.md }}>
        {selected ? (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: text.muted, fontSize: "0.86rem", fontWeight: 700 }}>
                {SOURCE_LABELS[selected.sourceKind]}
              </div>
              <div style={{ color: text.primary, fontSize: "1.2rem", fontWeight: 850 }}>{selected.title}</div>
              <div style={{ color: text.secondary, lineHeight: 1.6 }}>{selected.body}</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <span style={{ color: text.muted }}>Status</span>
                <strong>{formatStatus(selected.status)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <span style={{ color: text.muted }}>Priority</span>
                <strong>{formatStatus(selected.priority)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <span style={{ color: text.muted }}>Updated</span>
                <strong>{formatDate(selected.occurredAt)}</strong>
              </div>
            </div>
            {selectedWorkspace ? (
              <a
                href={selectedWorkspace.href}
                style={{
                  alignItems: "center",
                  background: colors.accent,
                  borderRadius: 999,
                  color: "#fff",
                  display: "inline-flex",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  gap: 8,
                  justifySelf: "start",
                  padding: "10px 14px",
                  textDecoration: "none",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {selectedWorkspace.label}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </a>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}
