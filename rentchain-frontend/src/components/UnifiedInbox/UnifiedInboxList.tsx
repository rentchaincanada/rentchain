import React from "react";
import { ArrowUpRight, ChevronRight, Inbox } from "lucide-react";
import type { UnifiedInboxRecord, UnifiedInboxRole, UnifiedInboxSourceKind } from "../../api/unifiedInboxApi";
import { Card } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type Props = {
  records: UnifiedInboxRecord[];
  role: UnifiedInboxRole;
  onOpenRecord?: (record: UnifiedInboxRecord) => void;
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

type WorkspaceAction = {
  href: string;
  label: string;
  helper: string;
};

function workspaceForRecord(record: UnifiedInboxRecord, role: UnifiedInboxRole): WorkspaceAction | null {
  if (role === "tenant") return null;
  if (role === "contractor") return null;
  const recordBody = `${record.title} ${record.body}`;
  const isPaymentLike = /\b(payment|payments|rent|invoice|charge|balance|outstanding|collection)\b/i.test(recordBody);
  if (record.sourceKind.includes("maintenance") || record.sourceKind.includes("work_order")) {
    return {
      href: "/work-orders",
      label: "Open related work orders",
      helper: "Use the work order workspace to find the related maintenance item.",
    };
  }
  if (record.sourceKind.includes("lease")) {
    return {
      href: "/leases",
      label: isPaymentLike ? "Open related leases" : "Open lease workspace",
      helper: isPaymentLike
        ? "Open the lease workspace to find the related summary or payment ledger."
        : "Open the lease workspace to find the related lease record.",
    };
  }
  if (record.sourceKind.includes("application") || record.sourceKind.includes("screening") || record.sourceKind.includes("viewing")) {
    return {
      href: "/applications",
      label: "Open related applications",
      helper: "Open the application workspace to find the related application, screening, or viewing record.",
    };
  }
  if (isPaymentLike) {
    return {
      href: "/payments",
      label: "Open payment workspace",
      helper: "Open Payments to review payment setup, balances, or collection activity.",
    };
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

export function UnifiedInboxList({ records, role, onOpenRecord }: Props) {
  const safeRecords = records.filter((record) => isSafeRecordForRole(record, role));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = safeRecords.find((record) => record.id === selectedId) || null;

  React.useEffect(() => {
    if (!safeRecords.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && !safeRecords.some((record) => record.id === selectedId)) {
      setSelectedId(null);
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
    <div style={{ display: "grid", gap: spacing.sm }}>
      {safeRecords.map((record) => {
        const active = record.id === selected?.id;
        const priority = priorityTone(record.priority);
        const status = statusTone(record.status);
        const selectedWorkspace = active ? workspaceForRecord(record, role) : null;
        return (
          <React.Fragment key={record.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(record.id);
                onOpenRecord?.(record);
              }}
              aria-current={active ? "true" : undefined}
              aria-expanded={active}
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
            {active ? (
              <Card
                data-testid="unified-inbox-detail-panel"
                style={{
                  background: "#f8fafc",
                  borderColor: "rgba(37, 99, 235, 0.16)",
                  borderLeft: `3px solid ${colors.accent}`,
                  boxShadow: "none",
                  display: "grid",
                  gap: spacing.md,
                  marginLeft: spacing.md,
                  marginTop: `-${spacing.xs}`,
                  maxWidth: `calc(100% - ${spacing.md})`,
                  padding: spacing.md,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: text.muted, fontSize: "0.86rem", fontWeight: 700 }}>
                    {SOURCE_LABELS[record.sourceKind]}
                  </div>
                  <div style={{ color: text.primary, fontSize: "1.2rem", fontWeight: 850 }}>{record.title}</div>
                  <div style={{ color: text.secondary, lineHeight: 1.6 }}>{record.body}</div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <span style={{ color: text.muted }}>Status</span>
                    <strong>{formatStatus(record.status)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <span style={{ color: text.muted }}>Priority</span>
                    <strong>{formatStatus(record.priority)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <span style={{ color: text.muted }}>Updated</span>
                    <strong>{formatDate(record.occurredAt)}</strong>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                  {selectedWorkspace ? (
                    <>
                      <div style={{ color: text.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                        {selectedWorkspace.helper}
                      </div>
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
                    </>
                  ) : (
                    <div style={{ color: text.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                      This inbox item does not include a linked workspace action yet.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
