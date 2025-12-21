// src/routes/dashboard.ts
import { Router } from "express";
import { getDashboardOverview } from "../services/dashboardOverviewService";
import { buildPortfolioInsightsResponse } from "../services/portfolioInsightsService";

const router = Router();

/**
 * GET /dashboard/overview
 * Existing overview endpoint (KPIs, properties, etc.)
 */
router.get("/overview", async (_req, res) => {
  try {
    const overview = await getDashboardOverview();
    return res.status(200).json(overview);
  } catch (err: any) {
    console.error("[GET /dashboard/overview] error:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to load overview" });
  }
});

/**
 * GET /dashboard/ai-insights
 * Portfolio-level AI-style insights: risk, cashflow, collections.
 */
router.get("/ai-insights", async (_req, res) => {
  try {
    const payload = await buildPortfolioInsightsResponse();
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[GET /dashboard/ai-insights] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to generate portfolio AI insights",
    });
  }
});

/**
 * GET /dashboard/portfolio-summary
 * Basic portfolio rollup + lightweight narrative (no external AI calls yet).
 */
router.get("/portfolio-summary", async (_req, res) => {
  try {
    const overview = await getDashboardOverview();
    const kpis = overview?.kpis ?? {};

    const totalProperties =
      typeof kpis.totalProperties === "number" ? kpis.totalProperties : 0;
    const totalUnits =
      typeof kpis.totalUnits === "number" ? kpis.totalUnits : 0;
    const occupancyRate =
      typeof kpis.occupancyRate === "number" ? kpis.occupancyRate : 0;
    const monthlyRentRoll =
      typeof kpis.monthlyRentRoll === "number" ? kpis.monthlyRentRoll : 0;
    const monthlyCollected =
      typeof kpis.monthlyCollected === "number" ? kpis.monthlyCollected : 0;
    const monthlyDelinquent =
      typeof kpis.monthlyDelinquent === "number" ? kpis.monthlyDelinquent : 0;

    const collectionRatio =
      monthlyRentRoll > 0 ? monthlyCollected / monthlyRentRoll : 1;
    const delinquencyRatio =
      monthlyRentRoll > 0 ? monthlyDelinquent / monthlyRentRoll : 0;

    const occupancyPct = (occupancyRate * 100).toFixed(1);
    const collectionPct = (collectionRatio * 100).toFixed(1);
    const delinquencyPct = (delinquencyRatio * 100).toFixed(1);

    let delinquencyLabel = "low";
    if (delinquencyRatio > 0.1) {
      delinquencyLabel = "high";
    } else if (delinquencyRatio > 0.05) {
      delinquencyLabel = "moderate";
    }

    const narrativeParts = [
      `Your portfolio spans ${totalProperties} properties and ${totalUnits} units, currently ${occupancyPct}% occupied.`,
      `Monthly rent roll is $${monthlyRentRoll.toLocaleString()}, with collections at ${collectionPct}% of expected.`,
      `Delinquency sits at ${delinquencyPct}% (${delinquencyLabel}), suggesting ${delinquencyLabel === "low" ? "stable cashflow" : "attention to a few at-risk tenants"}.`,
    ];

    const narrative = narrativeParts.join(" ");

    return res.status(200).json({
      ok: true,
      summary: {
        kpis: {
          totalProperties,
          totalUnits,
          occupancyRate,
          monthlyRentRoll,
          monthlyCollected,
          monthlyDelinquent,
        },
        narrative,
      },
    });
  } catch (err: any) {
    console.error("[GET /dashboard/portfolio-summary] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to load portfolio summary",
    });
  }
});

// GET /dashboard/ai-portfolio-summary
router.get("/ai-portfolio-summary", async (_req, res) => {
  try {
    // Reuse your existing overview service as the data source
    const overview: any = await getDashboardOverview();
    const kpis = overview?.kpis || {};
    const properties = overview?.properties || [];

    const occupancyRate =
      typeof kpis.occupancyRate === "number" ? kpis.occupancyRate : 0;

    const monthlyRentRoll =
      typeof kpis.monthlyRentRoll === "number" ? kpis.monthlyRentRoll : 0;

    const monthlyCollected =
      typeof kpis.monthlyCollected === "number" ? kpis.monthlyCollected : 0;

    const monthlyDelinquent =
      typeof kpis.monthlyDelinquent === "number" ? kpis.monthlyDelinquent : 0;

    const collectionRatio =
      monthlyRentRoll > 0 ? monthlyCollected / monthlyRentRoll : 1;

    const delinquencyRatio =
      monthlyRentRoll > 0 ? monthlyDelinquent / monthlyRentRoll : 0;

    // Simple health score (0–100) to drive the UI
    let healthScore = 80;

    if (occupancyRate < 0.9) healthScore -= 10;
    if (occupancyRate < 0.85) healthScore -= 10;

    if (collectionRatio < 0.95) healthScore -= 10;
    if (collectionRatio < 0.9) healthScore -= 10;

    if (delinquencyRatio > 0.05) healthScore -= 5;
    if (delinquencyRatio > 0.1) healthScore -= 10;

    if (healthScore < 0) healthScore = 0;
    if (healthScore > 100) healthScore = 100;

    const risks: string[] = [];
    const opportunities: string[] = [];

    if (occupancyRate < 0.9) {
      risks.push(
        `Occupancy is at ${(occupancyRate * 100).toFixed(
          1
        )}%, which is below a typical 95% target.`
      );
    } else {
      opportunities.push(
        `Strong occupancy at ${(occupancyRate * 100).toFixed(
          1
        )}%. Consider optimizing rents on stable units.`
      );
    }

    if (collectionRatio < 0.95) {
      risks.push(
        `Collections are at ${(collectionRatio * 100).toFixed(
          1
        )}% of rent roll. Some cash is being left on the table.`
      );
    } else {
      opportunities.push(
        `Collections are healthy at ${(collectionRatio * 100).toFixed(
          1
        )}% of rent roll.`
      );
    }

    if (delinquencyRatio > 0.05) {
      risks.push(
        `Delinquency is ${(delinquencyRatio * 100).toFixed(
          1
        )}% of rent roll. Investigate tenants slipping behind.`
      );
    }

    // Property-level highlights (if available)
    if (Array.isArray(properties) && properties.length > 0) {
      const sortedByRisk = [...properties].sort(
        (a, b) => (b.riskScore || 0) - (a.riskScore || 0)
      );
      const topRisk = sortedByRisk[0];

      if (topRisk && topRisk.name) {
        risks.push(
          `Property “${topRisk.name}” is showing the highest relative risk in your portfolio.`
        );
      }

      const sortedByRent = [...properties].sort(
        (a, b) => (b.avgRent || 0) - (a.avgRent || 0)
      );
      const topRent = sortedByRent[0];

      if (topRent && topRent.name) {
        opportunities.push(
          `“${topRent.name}” commands the highest average rent; consider duplicating its playbook at underperforming sites.`
        );
      }
    }

    // Simple textual summary
    let summary = "Portfolio is stable.";
    if (healthScore >= 85) {
      summary =
        "Portfolio is in strong shape with healthy occupancy and collections.";
    } else if (healthScore >= 70) {
      summary =
        "Portfolio is generally healthy with a few emerging areas to watch.";
    } else if (healthScore >= 50) {
      summary =
        "Portfolio is under some pressure; address risk hotspots to avoid slippage.";
    } else {
      summary =
        "Portfolio is at elevated risk; collections and occupancy need urgent attention.";
    }

    const response = {
      summary,
      healthScore,
      timeframeLabel: "Last 30 days (snapshot)",
      kpis: {
        occupancyRate,
        monthlyRentRoll,
        monthlyCollected,
        monthlyDelinquent,
        collectionRatio,
        delinquencyRatio,
      },
      trend: {
        collectionsDirection: "flat" as const,
        riskDirection: "flat" as const,
      },
      risks,
      opportunities,
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("[GET /dashboard/ai-portfolio-summary] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to compute portfolio AI summary",
    });
  }
});

export default router;
