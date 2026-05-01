import React from "react";
import { Card } from "../ui/Ui";
import type { AnalyticsAlert } from "@/api/landlordAnalyticsAlertsApi";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";
import type { LandlordAnalyticsInsight } from "@/api/landlordAnalyticsApi";
import {
  analyticsInsightIntroCopy,
  insightNextStepCopy,
  shouldRenderInsightCard,
} from "@/lib/analytics/analyticsInsightCopy";

const severityColor: Record<LandlordAnalyticsInsight["severity"], string> = {
  low: "#0369a1",
  medium: "#b45309",
  high: "#b91c1c",
};

type Props = {
  insights: LandlordAnalyticsInsight[];
  alerts?: AnalyticsAlert[];
  decisions?: LandlordAgentDecision[];
};

export function InsightCardsPanel({ insights, alerts = [], decisions = [] }: Props) {
  const visibleInsights = insights.filter((insight) =>
    shouldRenderInsightCard({
      insight,
      alerts,
      decisions,
    })
  );

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Attention-worthy insights</h2>
          <div style={{ color: "#475569" }}>
            {analyticsInsightIntroCopy()}
          </div>
        </div>

        {visibleInsights.length === 0 ? (
          <div style={{ color: "#64748b" }}>No standout analytics signals in this view right now.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleInsights.map((insight, index) => (
              <div
                key={`${insight.type}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                  display: "grid",
                  gap: 6,
                  background: "#fff",
                }}
              >
                <div style={{ color: severityColor[insight.severity], fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase" }}>
                  {insight.severity}
                </div>
                <div style={{ color: "#0f172a", fontWeight: 600 }}>{insight.message}</div>
                <div style={{ color: "#334155", fontSize: "0.88rem", fontWeight: 600 }}>
                  {insightNextStepCopy(insight)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default InsightCardsPanel;
