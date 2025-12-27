import express from "express";

const router = express.Router();

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

router.get("/ai-portfolio-summary", (_req, res) => {
  res.json({
    ok: true,
    summary: "Portfolio summary is not available yet. Connect data sources to enable AI insights.",
    flags: [],
    updatedAt: new Date().toISOString(),
  });
});

export default router;
