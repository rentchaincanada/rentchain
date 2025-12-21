// src/routes/adminEventProcessorRoutes.ts
import { Router, Request, Response } from "express";
import { processRecentPaymentEvents } from "../services/eventProcessorService";

const router = Router();

/**
 * POST /admin/process-events/payments
 *
 * Manual trigger for the payment event processor skeleton.
 */
router.post(
  "/process-events/payments",
  async (req: Request, res: Response) => {
    try {
      const limitParam = req.query.limit as string | undefined;
      const limit = limitParam ? parseInt(limitParam, 10) : 50;

      const result = await processRecentPaymentEvents(limit);

      return res.json({
        success: true,
        limit,
        result,
      });
    } catch (error) {
      console.error("[Admin] Error processing payment events:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process payment events",
      });
    }
  }
);

export default router;
