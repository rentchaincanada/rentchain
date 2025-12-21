// src/components/dashboard/PortfolioAiSummary.tsx

import React, { useMemo } from "react";
import { TenantRiskRow } from "./TenantRiskTable";

interface PortfolioAiSummaryProps {
  kpis: any; // using loose typing to fit existing kpis shape
  tenants?: TenantRiskRow[] | null;
}

/**
 * Portfolio-level "AI-style" summary using KPIs + tenant risk.
 * No backend changes – just smart analytics on existing data.
 */
export const PortfolioAiSummary: React.FC<PortfolioAiSummaryProps> = ({
  kpis,
  tenants,
}) => {
  const insights = useMemo(() => {
    if (!kpis && (!tenants || tenants.length === 0)) {
      return null;
    }

    const totalUnits = kpis?.totalUnits ?? null;
    const totalProperties = kpis?.totalProperties ?? null;
    const occupancyRate = kpis?.occupancyRate ?? null;
    const monthlyRentRoll = kpis?.monthlyRentRoll ?? null;
    const monthlyDelinquent = kpis?.monthlyDelinquent ?? null;

    const delinquencyRate =
      monthlyRentRoll && monthlyRentRoll > 0
        ? monthlyDelinquent / monthlyRentRoll
        : 0;

    const list = tenants ?? [];
    const highRiskCount = list.filter(
      (t) => (t.riskLevel ?? "").toLowerCase() === "high"
    ).length;
    const mediumRiskCount = list.filter(
      (t) => (t.riskLevel ?? "").toLowerCase() === "medium"
    ).length;
    const lowRiskCount = list.filter(
      (t) => (t.riskLevel ?? "").toLowerCase() === "low"
    ).length;

    // Headline sentiment
    let headline: string;
    if (delinquencyRate > 0.12 || highRiskCount >= 3) {
      headline =
        "Portfolio risk is elevated – delinquency and high-risk tenants need active management.";
    } else if (delinquencyRate > 0.05 || highRiskCount > 0) {
      headline =
        "Portfolio risk is moderate – a few tenants are driving most of the exposure.";
    } else {
      headline =
        "Portfolio appears stable with manageable risk across current tenants.";
    }

    // Recommendations
    const recommendations: string[] = [];

    if (highRiskCount > 0) {
      recommendations.push(
        `Focus immediate attention on the ${highRiskCount} high-risk tenant${
          highRiskCount > 1 ? "s" : ""
        } – review payment plans, communication history, and consider proactive outreach.`
      );
    }

    if (delinquencyRate > 0.12) {
      recommendations.push(
        `Delinquency is above 12% of rent roll. Consider tightening screening, adjusting late-fee policies, and increasing follow-up cadence.`
      );
    } else if (delinquencyRate > 0.05) {
      recommendations.push(
        `Delinquency is in a watch zone. Track trends over the next 1–2 months and identify if a small number of tenants are driving most of the balance.`
      );
    } else {
      recommendations.push(
        "Delinquency is within a healthy range. Maintain current processes and continue monitoring payment behavior monthly."
      );
    }

    if (occupancyRate !== null && occupancyRate < 0.9) {
      recommendations.push(
        "Occupancy is under 90%. Consider short-term leasing incentives or marketing boosts on underperforming properties."
      );
    }

    if (lowRiskCount > mediumRiskCount + highRiskCount) {
      recommendations.push(
        "Majority of tenants skew low risk. Explore gentle rent optimization or renewal strategies to capture upside while maintaining stability."
      );
    }

    return {
      totalUnits,
      totalProperties,
      occupancyRate,
      monthlyRentRoll,
      monthlyDelinquent,
      delinquencyRate,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      headline,
      recommendations,
    };
  }, [kpis, tenants]);

  if (!insights) {
    return null;
  }

  const {
    totalUnits,
    totalProperties,
    occupancyRate,
    monthlyRentRoll,
    monthlyDelinquent,
    delinquencyRate,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    headline,
    recommendations,
  } = insights;

  const fmtCurrency = (val?: number | null) =>
    typeof val === "number"
      ? val.toLocaleString("en-CA", {
          style: "currency",
          currency: "CAD",
          maximumFractionDigits: 0,
        })
      : "—";

  const fmtPercent = (val?: number | null) =>
    typeof val === "number" ? `${Math.round(val * 100)}%` : "—";

  return (
    <div className="dashboard-card portfolio-ai-summary">
      <div className="portfolio-ai-header">
        <h2>Portfolio AI summary</h2>
        <span className="badge badge-soft">Beta</span>
      </div>

      <p className="portfolio-ai-headline">{headline}</p>

      <div className="portfolio-ai-metrics">
        <div className="metric">
          <span className="label">Units</span>
          <span className="value">
            {totalUnits ?? "—"}
            {totalProperties ? ` in ${totalProperties} properties` : ""}
          </span>
        </div>
        <div className="metric">
          <span className="label">Occupancy</span>
          <span className="value">
            {fmtPercent(occupancyRate ?? null)}
          </span>
        </div>
        <div className="metric">
          <span className="label">Monthly rent roll</span>
          <span className="value">{fmtCurrency(monthlyRentRoll)}</span>
        </div>
        <div className="metric">
          <span className="label">Delinquent this month</span>
          <span className="value">
            {fmtCurrency(monthlyDelinquent)}{" "}
            <span className="sub-value">
              ({fmtPercent(delinquencyRate)})
            </span>
          </span>
        </div>
        <div className="metric">
          <span className="label">Risk mix</span>
          <span className="value">
            {lowRiskCount} low · {mediumRiskCount} med · {highRiskCount} high
          </span>
        </div>
      </div>

      <ul className="portfolio-ai-recommendations">
        {recommendations.map((rec, idx) => (
          <li key={idx}>{rec}</li>
        ))}
      </ul>
    </div>
  );
};

export default PortfolioAiSummary;
