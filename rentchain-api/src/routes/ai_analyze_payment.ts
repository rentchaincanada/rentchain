import { Router } from "express";
import { randomUUID } from "crypto";
import { runAIAgent } from "../ai/agent";

export const aiAnalyzePaymentRouter = Router();

/**
 * POST /ai/analyze-payment
 *
 * Body example:
 * {
 *   "tenantId": "T123",
 *   "monthlyRent": 1200,
 *   "payments": [
 *      { "date": "2025-01-01", "amount": 1200, "late": false },
 *      { "date": "2025-02-01", "amount": 1200, "late": true }
 *   ],
 *   "notes": "Tenant reported temporary job loss"
 * }
 */
aiAnalyzePaymentRouter.post("/", async (req, res) => {
  try {
    const requestId = randomUUID();

    const payload = {
      requestId,
      inputType: "rent_payment_analysis",
      inputData: req.body
    };

    const result = await runAIAgent(payload);

    res.json({
      status: "AI rent payment analysis complete",
      ...result
    });
  } catch (err: any) {
    console.error("[AI Analyze Payment Error]:", err?.message || err);
    res.status(500).json({
      error: "AI rent payment analysis failed",
      detail: err?.message
    });
  }
});
