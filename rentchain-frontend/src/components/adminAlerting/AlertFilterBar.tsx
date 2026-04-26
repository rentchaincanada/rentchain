import React from "react";
import { Button, Card } from "../ui/Ui";

export default function AlertFilterBar(props: {
  category: string;
  severity: string;
  resourceType: string;
  watchedOnly: boolean;
  onCategoryChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onResourceTypeChange: (value: string) => void;
  onWatchedOnlyChange: (value: boolean) => void;
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Category filter</span>
            <select aria-label="Category filter" value={props.category} onChange={(event) => props.onCategoryChange(event.target.value)}>
              <option value="">All categories</option>
              <option value="screening_reconciliation">Screening reconciliation</option>
              <option value="portfolio_score_change">Portfolio score change</option>
              <option value="policy_exception">Policy exception</option>
              <option value="automation_exception">Automation exception</option>
              <option value="maintenance_friction">Maintenance friction</option>
              <option value="resolution_attention">Resolution attention</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Severity filter</span>
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
              <option value="">All resource types</option>
              <option value="application">Application</option>
              <option value="maintenance">Maintenance</option>
              <option value="lease">Lease</option>
              <option value="portfolio">Portfolio</option>
            </select>
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={props.watchedOnly} onChange={(event) => props.onWatchedOnlyChange(event.target.checked)} />
          <span>Watched items only</span>
        </label>
        <div>
          <Button variant="secondary" onClick={props.onRefresh} disabled={props.loading}>
            Refresh alerts
          </Button>
        </div>
      </div>
    </Card>
  );
}
