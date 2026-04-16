import React from "react";
import { Card } from "../ui/Ui";
import type { PortfolioScoreV1 } from "../../api/portfolioScoreApi";

export default function PortfolioScoreMetrics({ metrics }: { metrics: PortfolioScoreV1["metrics"] }) {
  const items = [
    ["Resources reviewed", metrics.totalResourcesReviewed],
    ["Open triage items", metrics.triageItemCount],
    ["Critical triage", metrics.criticalTriageCount],
    ["Reconciliation issues", metrics.reconciliationIssueCount],
    ["Automation skips", metrics.automationSkipCount],
    ["Policy reviews", metrics.policyReviewCount],
    ["Blocked workflows", metrics.blockedWorkflowCount],
    ["Maintenance reopens", metrics.maintenanceReopenCount],
  ];

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Key metrics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {items.map(([label, value]) => (
            <div key={String(label)} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: "1.25rem", marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

