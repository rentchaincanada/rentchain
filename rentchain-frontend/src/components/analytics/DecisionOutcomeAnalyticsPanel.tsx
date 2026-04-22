import React from "react";
import type { LandlordDecisionOutcomeAnalytics } from "@/api/landlordAnalyticsApi";
import AnalyticsSectionPanel from "./AnalyticsSectionPanel";

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDurationHours(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours >= 48) return `${(hours / 24).toFixed(1)}d`;
  if (hours >= 1) return `${Math.round(hours)}h`;
  return `${Math.round(hours * 60)}m`;
}

type Props = {
  analytics: LandlordDecisionOutcomeAnalytics | null | undefined;
};

export default function DecisionOutcomeAnalyticsPanel({ analytics }: Props) {
  if (!analytics) return null;

  return (
    <AnalyticsSectionPanel
      title="Decision outcomes"
      description="All-time landlord decision outcomes from canonical decision events."
      metrics={[
        {
          label: "Appeared",
          value: String(analytics.appearedCount),
          hint: "Unique decisions first surfaced in canonical history.",
        },
        {
          label: "Reviewed",
          value: String(analytics.reviewedCount),
          hint: "Decisions with a canonical reviewed event.",
        },
        {
          label: "Executed",
          value: String(analytics.executedCount),
          hint: "Decisions with a canonical executed event.",
        },
        {
          label: "Failed",
          value: String(analytics.failedExecutionCount),
          hint: "Decisions with at least one canonical execution failure.",
        },
        {
          label: "Resolved",
          value: String(analytics.resolvedCount),
          hint: `Reviewed, dismissed, or executed. Resolution rate ${formatPercent(analytics.resolutionRate)}.`,
        },
        {
          label: "Median time to resolution",
          value: formatDurationHours(analytics.medianTimeToResolutionHours),
          hint: "From appeared to the earliest reviewed, dismissed, or executed event.",
        },
      ]}
    />
  );
}
