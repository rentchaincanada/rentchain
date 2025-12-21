import express, { Request, Response } from "express";

const router = express.Router();

// TODO: replace this with real Firestore query later
const MOCK_PAYMENTS = [
  {
    id: "pmt-1",
    tenantId: "t1",
    propertyId: "p-main",
    amount: 1450,
    dueDate: "2025-11-01",
    paidAt: "2025-11-01",
    status: "Paid",
  },
  {
    id: "pmt-2",
    tenantId: "t1",
    propertyId: "p-main",
    amount: 1450,
    dueDate: "2025-10-01",
    paidAt: "2025-10-05",
    status: "Late",
  },
  {
    id: "pmt-3",
    tenantId: "t2",
    propertyId: "p-downtown",
    amount: 1650,
    dueDate: "2025-11-01",
    paidAt: null,
    status: "Unpaid",
  },
];

router.get(
  "/:tenantId/payments",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;

      // Later: query Firestore for events/records instead of filtering mock
      const payments = MOCK_PAYMENTS.filter(
        (pmt) => pmt.tenantId === tenantId
      );

      res.json(payments);
    } catch (err) {
      console.error("Error loading tenant payments", err);
      res.status(500).json({ error: "Failed to load tenant payments" });
    }
  }
);

export default router;
