// src/components/dashboard/TenantAiInsights.tsx

import React, { useMemo } from "react";
import { TenantDetailsModel } from "../tenants/TenantDetails";
import { TenantRiskRow } from "./TenantRiskTable";

interface TenantAiInsightsProps {
  tenant: TenantRiskRow | null;
  details: TenantDetailsModel | null;
}

/**
 * Lightweight "AI-style" insights generator using
 * payment history + balance + risk level.
 * This is deterministic analytics dressed like AI – perfect for MVP.
 */
export const TenantAiInsights: React.FC<TenantAiInsightsProps> = ({
  tenant,
  details,
}) => {
  const insights = useMemo(() => {
    if (!tenant || !details) {
      return null;
    }

    const history = details.paymentHistory ?? [];
    const totalPayments = history.length;
    const onTimeCount = history.filter((p) => p.status === "on-time").length;
    const lateCount = history.filter((p) => p.status === "late").length;
    const partialCount = history.filter((p) => p.status === "partial").length;
    const missedCount = history.filter((p) => p.status === "missed").length;

    const onTimeRate =
      totalPayments > 0 ? Math.round((onTimeCount / totalPayments) * 100) : 0;

    const currentBalance = details.currentBalance ?? 0;
    const riskLevel = (details.riskLevel ?? tenant.riskLevel ?? "Medium")
      .toString()
      .toLowerCase();

    // High-level narrative
    let headline: string;
    if (riskLevel === "high") {
      headline = "High risk of continued delinquency without intervention.";
    } else if (riskLevel === "medium") {
      headline = "Moderate risk – worth active monitoring and engagement.";
    } else {
      headline = "Low risk – generally stable payment behavior.";
    }

    // Recommendations list
    const recommendations: string[] = [];

    if (onTimeRate >= 90 && currentBalance <= 0 && lateCount === 0) {
      recommendations.push(
        "Consider prioritizing this tenant for renewal at market rent – strong payment behavior."
      );
    }

    if (lateCount > 0 || partialCount > 0 || missedCount > 0) {
      recommendations.push(
        "Review the last 3–6 months of payments and document reasons for late or partial payments."
      );
    }

    if (currentBalance > 0) {
      recommendations.push(
        `Current outstanding balance is ${currentBalance.toLocaleString(
          "en-CA",
          { style: "currency", currency: "CAD" }
        )}. Consider offering a structured repayment plan and setting clear expectations.`
      );
    }

    if (riskLevel === "high" || missedCount > 0) {
      recommendations.push(
        "Allocate additional follow-up touchpoints (call, email, in-person) and review whether this tenant fits your long-term portfolio risk tolerance."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "No immediate red flags detected. Maintain normal follow-up cadence and monitor for changes in income or payment patterns."
      );
    }

    return {
      headline,
      onTimeRate,
      lateCount,
      partialCount,
      missedCount,
      currentBalance,
      recommendations,
    };
  }, [tenant, details]);

  if (!tenant) {
    return null;
  }

  if (!insights) {
    return (
      <div className="tenant-ai-insights">
        <h3>Tenant AI insights</h3>
        <p>Select a tenant to view AI-generated risk insights.</p>
      </div>
    );
  }

  const {
    headline,
    onTimeRate,
    lateCount,
    partialCount,
    missedCount,
    currentBalance,
    recommendations,
  } = insights;

  return (
    <div className="tenant-ai-insights">
      <h3>Tenant AI insights</h3>
      <p className="tenant-ai-headline">{headline}</p>

      <div className="tenant-ai-metrics">
        <div className="metric">
          <span className="label">On-time rate</span>
          <span className="value">{onTimeRate}%</span>
        </div>
        <div className="metric">
          <span className="label">Late</span>
          <span className="value">{lateCount}</span>
        </div>
        <div className="metric">
          <span className="label">Partial</span>
          <span className="value">{partialCount}</span>
        </div>
        <div className="metric">
          <span className="label">Missed</span>
          <span className="value">{missedCount}</span>
        </div>
        <div className="metric">
          <span className="label">Outstanding balance</span>
          <span
            className={
              currentBalance > 0
                ? "value text-negative"
                : currentBalance < 0
                ? "value text-positive"
                : "value"
            }
          >
            {currentBalance.toLocaleString("en-CA", {
              style: "currency",
              currency: "CAD",
            })}
          </span>
        </div>
      </div>

      <ul className="tenant-ai-recommendations">
        {recommendations.map((rec, idx) => (
          <li key={idx}>{rec}</li>
        ))}
      </ul>
    </div>
  );
};

export default TenantAiInsights;
