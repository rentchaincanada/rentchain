// src/routes/paymentListRoutes.ts
import { Router, Request, Response } from "express";

const router = Router();

type Payment = {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | null;
};

// Temporary in-memory demo data – replace with Firestore later
const demoPayments: Payment[] = [
  {
    id: "qis7syeydNzdIMBf9mfl",
    tenantId: "t1",
    amount: 500,
    paidAt: "2025-12-03",
    method: "e-transfer",
    notes: null,
  },
  {
    id: "q9Z8J5FJ80oqBTfLK10E",
    tenantId: "t3",
    amount: 1800,
    paidAt: "2025-12-03",
    method: "e-transfer",
    notes: null,
  },
  {
    id: "nxCT8lZ2V9uEE5D2m7Ba",
    tenantId: "t2",
    amount: 1200,
    paidAt: "2025-12-02",
    method: "cash",
    notes: "December rent",
  },
];

// GET /api/payments?tenantId=t1
router.get("/payments", (req: Request, res: Response) => {
  const tenantId = req.query.tenantId as string | undefined;

  // No tenantId = return all payments (handy for dashboard later)
  if (!tenantId) {
    return res.json(demoPayments);
  }

  const filtered = demoPayments.filter((p) => p.tenantId === tenantId);
  return res.json(filtered);
});

export default router;
