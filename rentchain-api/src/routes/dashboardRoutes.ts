import express from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

// Set route source header for debugging
router.use((req, res, next) => {
  res.setHeader("x-route-source", "dashboardRoutes");
  next();
});

/**
 * GET /api/dashboard/overview
 * Minimal KPIs (placeholder/zeroed for now)
 */
router.get("/overview", authenticateJwt, (_req, res) => {
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
router.get("/ai-portfolio-summary", authenticateJwt, (_req, res) => {
  res.json({
    ok: true,
    summary:
      "Portfolio summary is not available yet. Connect data sources to enable AI insights.",
    flags: [],
    updatedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/dashboard/ai-summary
 * Simple stubbed summary for now
 */
router.post("/ai-summary", authenticateJwt, (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  res.json({
    ok: true,
    summary: "Portfolio stable. No critical arrears. Two leases expiring soon.",
    bullets: ["Occupancy steady", "Monitor overdue items", "Plan renewals"],
  });
});

/**
 * GET /api/dashboard/ai-insights
 * Temporary stub — returns empty insights
 */
router.get("/ai-insights", authenticateJwt, (_req, res) => {
  res.json({
    items: [],
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

/**
 * GET /api/dashboard/summary
 * Aggregated dashboard snapshot (safe fallbacks)
 */
router.get("/summary", requireAuth, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const data = {
    kpis: {
      propertiesCount: 0,
      unitsCount: 0,
      tenantsCount: 0,
      openActionsCount: 0,
      delinquentCount: 0,
    },
    rent: {
      month,
      collectedCents: 0,
      expectedCents: 0,
      delinquentCents: 0,
    },
    actions: [] as any[],
    properties: [] as any[],
    events: [] as any[],
  };

  return res.json({ ok: true, data });
});

export default router;
