// src/routes/tenantAiRoutes.ts

import { Router, Request, Response, NextFunction } from "express";
import { runAIAgentAndReturnOutput } from "../ai/aiAgentService";
import { getTenantBalanceSummary } from "../services/tenantBalanceService";

const router = Router();

/**
 * POST /api/tenants/:tenantId/ai-insights
 *
 * Body can contain any structured tenant data you want to send, e.g.:
 * {
 *   "tenantName": "John Doe",
 *   "propertyName": "Main St. Apartments",
 *   "unit": "203",
 *   "currentBalance": -250,
 *   "paymentHistory": [...],
 *   "notes": "Has paid late 3 times in last 6 months"
 * }
 *
 * This route will automatically enrich the payload with:
 * - balanceSummary (from tenantBalances collection, if available)
 */
router.post(
  "/tenants/:tenantId/ai-insights",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      const body = req.body || {};

      // Pull balance summary from Firestore, if it exists
      const balanceSummary = await getTenantBalanceSummary(tenantId);

      const tenantPayload = {
        tenantId,
        balanceSummary, // may be null if no payments yet
        ...body,
      };

      const result = await runAIAgentAndReturnOutput({
        agent: "tenantInsights",
        input: tenantPayload,
      });

      return res.status(200).json({
        success: result.success,
        errorMessage: result.errorMessage,
        ai: result.output, // { text, model, usage }
        events: result.events, // request + completed events
      });
    } catch (err) {
      console.error("[Tenant AI] Error in /tenants/:tenantId/ai-insights:", err);
      next(err);
    }
  }
);

export default router;
