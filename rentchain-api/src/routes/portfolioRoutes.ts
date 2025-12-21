import express from "express";
import { getPortfolioOverview } from "../services/portfolioOverviewService";

const router = express.Router();

// GET /portfolio/overview
router.get("/overview", async (_req, res) => {
  try {
    const overview = await getPortfolioOverview();
    res.json(overview);
  } catch (err) {
    console.error("[GET /portfolio/overview] error:", (err as Error).message);
    res.status(500).json({ error: "Failed to load portfolio overview" });
  }
});

export default router;
