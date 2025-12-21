// src/routes/aiRoutes.ts

import { Router, Request, Response, NextFunction } from "express";
import {
  runAIAgentAndReturnOutput,
} from "../ai/aiAgentService";

const router = Router();

/**
 * POST /ai/execute
 *
 * Simple skeleton route to exercise the AI agent service.
 * Body:
 * {
 *   "agent": "portfolioInsights",
 *   "input": { ...anything... }
 * }
 */
router.post(
  "/execute",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agent, input } = req.body || {};

      if (!agent) {
        return res.status(400).json({
          error: "Missing required field: 'agent'",
        });
      }

      const result = await runAIAgentAndReturnOutput({ agent, input });

      return res.status(200).json({
        success: result.success,
        errorMessage: result.errorMessage,
        output: result.output,
        events: result.events,
      });
    } catch (err) {
      console.error("[AI Routes] Error in /ai/execute:", err);
      next(err);
    }
  }
);

export default router;
