// Temporary AI analysis stub – no provider dependency yet.

export type DashboardAiInsight = {
  id: string;
  type: "risk" | "opportunity" | "trend" | "anomaly" | "info";
  message: string;
  severity?: "low" | "medium" | "high";
};

export async function analyzeDashboardAi(payload: any): Promise<DashboardAiInsight[]> {
  const { selectedPropertyName, timeRange, kpis } = payload || {};

  const scopeLabel = selectedPropertyName || "your portfolio";
  const rangeLabel =
    timeRange === "90d"
      ? "last 90 days"
      : timeRange === "ytd"
      ? "year to date"
      : "last 30 days";

  const insights: DashboardAiInsight[] = [
    {
      id: "1",
      type: "trend",
      severity: "low",
      message: `Monitoring ${scopeLabel} over the ${rangeLabel}. Collection and occupancy appear stable based on current KPIs.`,
    },
    {
      id: "2",
      type: "opportunity",
      severity: "medium",
      message: `Consider reviewing rent levels at ${scopeLabel}. If occupancy is high and stable, there may be room for a modest rent increase on upcoming renewals.`,
    },
    {
      id: "3",
      type: "risk",
      severity: "medium",
      message: `Keep an eye on payment timing. Even small drops in collection rate or increased late payments at ${scopeLabel} can impact cashflow.`,
    },
  ];

  if (kpis && typeof kpis.collectionRate === "number") {
    const col = kpis.collectionRate;
    if (col < 0.9) {
      insights.push({
        id: "4",
        type: "risk",
        severity: "high",
        message: `Collection rate appears to be below 90%. This is a red flag – review your follow-up process for late payments at ${scopeLabel}.`,
      });
    } else if (col > 0.97) {
      insights.push({
        id: "5",
        type: "opportunity",
        severity: "low",
        message: `Collection rate is very strong. This stability may support new financing, refinancing, or selective upgrades at ${scopeLabel}.`,
      });
    }
  }

  return insights;
}
