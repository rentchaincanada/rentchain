// rentchain-frontend/src/components/dashboard/DashboardPortfolioSmartInsights.tsx
import React, { useMemo } from "react";
import { useDashboardOverviewForInsights } from "../../hooks/useDashboardOverviewForInsights";

export const DashboardPortfolioSmartInsights: React.FC = () => {
  const { data, loading, error } = useDashboardOverviewForInsights();

  const insightLines = useMemo(() => {
    if (!data) return [];

    const { kpis, properties } = data;
    const lines: string[] = [];

    const occPercent = Math.round(kpis.occupancyRate * 100);
    const rentRoll = kpis.monthlyRentRoll;
    const collected = kpis.monthlyCollected;
    const delinquent = kpis.monthlyDelinquent;

    const collectionRatio =
      rentRoll > 0 ? collected / rentRoll : 0;
    const delinquentRatio =
      rentRoll > 0 ? delinquent / rentRoll : 0;

    // Occupancy insight
    if (occPercent >= 95) {
      lines.push(
        `Portfolio occupancy is very strong at ~${occPercent}%, suggesting stable tenant demand across your ${kpis.totalUnits} units.`
      );
    } else if (occPercent >= 90) {
      lines.push(
        `Portfolio occupancy is healthy at ~${occPercent}%, but there may be room to improve leasing performance on a few properties.`
      );
    } else {
      lines.push(
        `Portfolio occupancy is at ~${occPercent}%, which is on the soft side. Focus on marketing and leasing for high-vacancy buildings.`
      );
    }

    // Collections vs rent roll
    lines.push(
      `This month’s rent roll is about $${rentRoll.toLocaleString()}, with roughly $${collected.toLocaleString()} collected so far.`
    );

    if (collectionRatio >= 0.98) {
      lines.push(
        `Collections are tracking very well (${Math.round(
          collectionRatio * 100
        )}% of rent roll collected), indicating strong payment behavior.`
      );
    } else if (collectionRatio >= 0.9) {
      lines.push(
        `You’ve collected around ${Math.round(
          collectionRatio * 100
        )}% of the rent roll — generally solid, but keep an eye on slower-paying tenants.`
      );
    } else {
      lines.push(
        `Collections are below optimal levels (${Math.round(
          collectionRatio * 100
        )}% of rent roll collected). Consider tightening follow-up on overdue accounts.`
      );
    }

    // Delinquency
    if (delinquent > 0) {
      lines.push(
        `There is about $${delinquent.toLocaleString()} currently marked as delinquent, representing roughly ${Math.round(
          delinquentRatio * 100
        )}% of the monthly rent roll.`
      );
    } else {
      lines.push(
        `No delinquent balance is currently recorded, which aligns with a low overall credit-risk profile.`
      );
    }

    // Property-level risk
    const highRisk = properties.filter((p) => p.risk === "High");
    const mediumRisk = properties.filter((p) => p.risk === "Medium");

    if (highRisk.length > 0) {
      const names = highRisk.map((p) => p.name).join(", ");
      lines.push(
        `High-risk watchlist: ${names}. Consider reviewing tenant mix, collections, and expenses at these assets.`
      );
    } else if (mediumRisk.length > 0) {
      const topMedium = mediumRisk
        .slice()
        .sort((a, b) => a.occupancyRate - b.occupancyRate)[0];
      lines.push(
        `No properties are tagged High risk. The primary building to watch is ${topMedium.name}, which is currently marked Medium risk.`
      );
    } else {
      lines.push(
        `All tracked properties are currently tagged Low risk, suggesting a broadly stable portfolio with no immediate red flags.`
      );
    }

    // Size / growth hint
    lines.push(
      `Total portfolio size: ${kpis.totalProperties} properties, ${kpis.totalUnits} units. This baseline can support future financing or refi conversations.`
    );

    return lines;
  }, [data]);

  if (loading) {
    return (
      <div
        style={{
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(129,140,248,0.14))",
          border: "1px solid rgba(129,140,248,0.45)",
          fontSize: "0.85rem",
          opacity: 0.9,
        }}
      >
        Loading portfolio insights...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
          backgroundColor: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(239,68,68,0.6)",
          fontSize: "0.85rem",
        }}
      >
        Failed to load portfolio insights: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        padding: "0.9rem 1.1rem",
        borderRadius: "0.9rem",
        background:
          "linear-gradient(135deg, rgba(56,189,248,0.16), rgba(129,140,248,0.2))",
        border: "1px solid rgba(94,234,212,0.5)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.6)",
        fontSize: "0.85rem",
      }}
    >
      <div
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          marginBottom: "0.3rem",
        }}
      >
        Portfolio Insights (prototype)
      </div>
      <div
        style={{
          opacity: 0.9,
          fontSize: "0.8rem",
          marginBottom: "0.4rem",
        }}
      >
        Auto-generated from your rent roll, collections, occupancy, and risk tags.
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: "1.1rem",
        }}
      >
        {insightLines.map((line, idx) => (
          <li
            key={idx}
            style={{
              marginBottom: idx === insightLines.length - 1 ? 0 : "0.25rem",
            }}
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
};
