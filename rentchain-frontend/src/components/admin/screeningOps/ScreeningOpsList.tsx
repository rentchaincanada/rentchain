import React from "react";
import { Card, Pill } from "@/components/ui/Ui";
import { colors, radius, spacing, text } from "@/styles/tokens";
import type { ScreeningOperation, ScreeningOperationStatus } from "@/api/screeningOpsApi";

type Props = {
  operations: ScreeningOperation[];
  loading?: boolean;
  selectedId?: string | null;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  onSelect?: (id: string) => void;
};

const FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Requested", value: "requested" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export function ScreeningOpsList({
  operations,
  loading = false,
  selectedId = null,
  statusFilter = "",
  onStatusFilterChange,
  onSelect,
}: Props) {
  return (
    <Card style={{ display: "grid", gap: spacing.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Screening Operations</div>
        <select
          aria-label="Filter operations by status"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange?.(event.target.value)}
          style={{ padding: "8px 10px", borderRadius: radius.md, border: `1px solid ${colors.border}` }}
        >
          {FILTERS.map((filter) => (
            <option key={filter.value || "all"} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ color: text.muted }}>Loading screening operations...</div>
      ) : operations.length === 0 ? (
        <div style={{ color: text.muted }}>No screening operations found.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {operations.map((operation) => (
            <button
              key={operation.id}
              type="button"
              onClick={() => onSelect?.(operation.id)}
              style={{
                textAlign: "left",
                padding: "12px",
                borderRadius: radius.md,
                border: `1px solid ${selectedId === operation.id ? colors.accent : colors.border}`,
                background: selectedId === operation.id ? "rgba(37,99,235,0.08)" : colors.card,
                cursor: "pointer",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{operation.applicantName || "Applicant"}</strong>
                <Pill>{operation.status as ScreeningOperationStatus}</Pill>
              </div>
              <div style={{ fontSize: 12, color: text.muted }}>Application: {operation.applicationId}</div>
              <div style={{ fontSize: 12, color: text.muted }}>
                Updated: {new Date(operation.updatedAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
