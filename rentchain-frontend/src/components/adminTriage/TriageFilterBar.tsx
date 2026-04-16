import React from "react";
import { Button, Card } from "../ui/Ui";

type TriageFilterBarProps = {
  category: string;
  severity: string;
  resourceType: string;
  includeLow: boolean;
  loading?: boolean;
  onCategoryChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onResourceTypeChange: (value: string) => void;
  onIncludeLowChange: (value: boolean) => void;
  onRefresh: () => void;
};

export function TriageFilterBar(props: TriageFilterBarProps) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Category</span>
          <select aria-label="Category filter" value={props.category} onChange={(event) => props.onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            <option value="screening_reconciliation">Screening reconciliation</option>
            <option value="policy_review">Policy review</option>
            <option value="automation_exception">Automation exception</option>
            <option value="maintenance_friction">Maintenance friction</option>
            <option value="workflow_stall">Workflow stall</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Severity</span>
          <select aria-label="Severity filter" value={props.severity} onChange={(event) => props.onSeverityChange(event.target.value)}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Resource type</span>
          <select aria-label="Resource type filter" value={props.resourceType} onChange={(event) => props.onResourceTypeChange(event.target.value)}>
            <option value="">All resources</option>
            <option value="application">Application</option>
            <option value="maintenance">Maintenance</option>
            <option value="lease">Lease</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
          <input
            aria-label="Include low severity"
            type="checkbox"
            checked={props.includeLow}
            onChange={(event) => props.onIncludeLowChange(event.target.checked)}
          />
          <span>Include low severity</span>
        </label>
      </div>
      <div>
        <Button variant="secondary" onClick={props.onRefresh} disabled={props.loading}>
          {props.loading ? "Refreshing..." : "Refresh queue"}
        </Button>
      </div>
    </Card>
  );
}

export default TriageFilterBar;

