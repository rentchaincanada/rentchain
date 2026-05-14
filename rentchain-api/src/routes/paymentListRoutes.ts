// src/routes/paymentListRoutes.ts
import { Router, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// GET /api/payments?tenantId=t1
router.get("/payments", requireAuth, (_req: any, res: Response) => {
  res.setHeader("x-route-source", "paymentListRoutes.ts");
  res.setHeader("x-payments-route-version", "legacy-demo-disabled");
  return res.json([]);
});

export default router;
