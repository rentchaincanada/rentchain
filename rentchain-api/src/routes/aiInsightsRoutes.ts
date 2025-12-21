// src/routes/aiInsightsRoutes.ts
import { Router, Request, Response } from "express";
import {
  getDashboardAiInsights,
  getTenantAiInsights,
} from "../services/aiInsightsService";

const router = Router();

/**
 * GET /dashboard/ai-insights
 * Portfolio-level AI insights (stubbed for now).
 */
router.get(
  "/dashboard/ai-insights",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = await getDashboardAiInsights();
      res.json(payload);
    } catch (err) {
      console.error("[AI] Error generating dashboard insights:", err);
      res.status(500).json({ error: "Failed to generate dashboard AI insights" });
    }
  }
);

/**
 * GET /tenants/:tenantId/ai-insights
 * Tenant-level AI insights (stubbed).
 */
router.get(
  "/tenants/:tenantId/ai-insights",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }

      const payload = await getTenantAiInsights(tenantId);
      res.json(payload);
    } catch (err) {
      console.error("[AI] Error generating tenant insights:", err);
      res.status(500).json({ error: "Failed to generate tenant AI insights" });
    }
  }
);

export default router;
