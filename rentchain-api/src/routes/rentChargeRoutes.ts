// src/routes/rentChargeRoutes.ts
import { Router, Request, Response } from "express";
import { recordRentCharge } from "../services/rentChargeService";

const router = Router();

/**
 * POST /admin/charges/rent
 *
 * Creates a RentCharged event for a single tenant.
 *
 * Body:
 * {
 *   "tenantId": "t1",
 *   "leaseId": "lease-123",        // optional
 *   "amount": 1450,
 *   "period": "2025-12",           // optional, will be inferred if missing
 *   "dueDate": "2025-12-01",       // optional, will be inferred if missing
 *   "description": "December 2025 rent" // optional
 * }
 */
router.post(
  "/rent",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        tenantId,
        leaseId,
        amount,
        period,
        dueDate,
        description,
      } = req.body || {};

      if (!tenantId || typeof tenantId !== "string") {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }

      if (amount == null) {
        res.status(400).json({ error: "amount is required" });
        return;
      }

      const result = await recordRentCharge({
        tenantId,
        leaseId,
        amount,
        period,
        dueDate,
        description,
      });

      res.status(201).json({
        success: true,
        charge: result,
      });
    } catch (err) {
      console.error("[POST /admin/charges/rent] error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to create rent charge",
        detail: message,
      });
    }
  }
);

export default router;
