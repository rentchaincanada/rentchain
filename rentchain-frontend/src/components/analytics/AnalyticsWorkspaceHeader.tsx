import React from "react";
import type { AnalyticsPeriod } from "@/api/landlordAnalyticsApi";
import { Button, Card } from "../ui/Ui";
import AnalyticsFiltersBar from "./AnalyticsFiltersBar";

type AnalyticsWorkspaceTabId =
  | "analytics-alerts"
  | "portfolio-benchmarking"
  | "decision-outcomes"
  | "operator-queue"
  | "recommended-next-actions"
  | "actions-to-review"
  | "predictive-metrics"
  | "attention-worthy-insights"
  | "portfolio-execution-summary";

type AnalyticsWorkspaceTab = {
  id: AnalyticsWorkspaceTabId;
  label: string;
};

type Props = {
  title: string;
  description: string;
  focusLabel: string | null;
  activeTab: AnalyticsWorkspaceTabId;
  tabs: AnalyticsWorkspaceTab[];
  period: AnalyticsPeriod;
  propertyId: string;
  properties: Array<{ id: string; name: string }>;
  disabled?: boolean;
  onTabChange: (tab: AnalyticsWorkspaceTabId) => void;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onPropertyChange: (propertyId: string) => void;
  onPrint: () => void;
};

export default function AnalyticsWorkspaceHeader({
  title,
  description,
  focusLabel,
  activeTab,
  tabs,
  period,
  propertyId,
  properties,
  disabled = false,
  onTabChange,
  onPeriodChange,
  onPropertyChange,
  onPrint,
}: Props) {
  return (
    <Card className="analytics-workspace-header" elevated>
      <div className="analytics-workspace-header__top">
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{title}</h1>
          <div style={{ color: "#475569", maxWidth: 840 }}>{description}</div>
          {focusLabel ? (
            <div style={{ color: "#0f766e", fontWeight: 600, fontSize: "0.92rem" }}>
              Focused from decisions: {focusLabel}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          className="no-print"
          variant="ghost"
          onClick={onPrint}
          style={{ fontWeight: 800, justifySelf: "start", whiteSpace: "nowrap" }}
        >
          Print / Save PDF
        </Button>
      </div>

      <div className="analytics-workspace-header__controls" aria-label="Analytics control area">
        <div
          role="tablist"
          aria-label="Analytics workspace sections"
          className="analytics-workspace-tabs"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`analytics-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`analytics-panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className="analytics-workspace-tab"
                data-active={selected ? "true" : "false"}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnalyticsFiltersBar
          embedded
          period={period}
          propertyId={propertyId}
          properties={properties}
          disabled={disabled}
          onPeriodChange={onPeriodChange}
          onPropertyChange={onPropertyChange}
        />
      </div>
    </Card>
  );
}
