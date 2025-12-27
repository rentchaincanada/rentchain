import express from "express";

const router = express.Router();

/**
 * GET /api/dashboard/overview
 * Minimal KPIs (placeholder/zeroed for now)
 */
router.get("/overview", (_req, res) => {
  res.json({
    ok: true,
    monthRent: 0,
    occupancyRate: 0,
    latePayments: 0,
    portfolioValue: 0,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/dashboard/ai-portfolio-summary
 * Deterministic placeholder summary
 */
router.get("/ai-portfolio-summary", (_req, res) => {
  res.json({
    ok: true,
    summary: "Portfolio summary not available yet. This is a placeholder response.",
    flags: [],
    updatedAt: new Date().toISOString(),
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

export default router;
