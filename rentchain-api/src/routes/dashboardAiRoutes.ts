import express from "express";

const router = express.Router();

/**
 * GET /api/dashboard/ai-insights
 * Temporary stub — returns empty insights
 */
router.get("/ai-insights", (_req, res) => {
  res.json({
    items: [],
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

/**
 * GET /api/dashboard/ai-portfolio-summary
 * Temporary stub — returns empty portfolio summary
 */
router.get("/ai-portfolio-summary", (_req, res) => {
  res.json({
    summary: null,
    items: [],
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

/**
 * POST /api/dashboard/ai-summary
 * Temporary stub — returns empty summary/metrics
 */
router.post("/ai-summary", (_req, res) => {
  res.json({
    summary: null,
    metrics: {
      portfolioValue: 0,
      monthlyRent: 0,
      occupancyRate: 0,
      latePayments: 0,
    },
    snapshot: {
      monthlyRent: 0,
      occupancyRate: 0,
      latePayments: 0,
      portfolioValue: 0,
    },
    aiSummary: {
      healthScore: 0,
      timeframeLabel: "Last 30 days",
      highlights: [],
      risks: [],
      actions: [],
    },
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

/**
 * GET /api/dashboard/overview
 * Temporary stub — returns zeroed KPI metrics
 */
router.get("/overview", (_req, res) => {
  res.json({
    monthlyRent: 0,
    occupancyRate: 0,
    latePayments: 0,
    portfolioValue: 0,
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

export default router;
