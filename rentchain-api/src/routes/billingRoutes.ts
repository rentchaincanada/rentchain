import express from "express";
import { listBillingRecords } from "../billing/billingService";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requirePermission("reports.view"),
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const records = await listBillingRecords(landlordId);
    res.json({ ok: true, records });
  }
);

router.get(
  "/receipts/:id",
  requireAuth,
  requirePermission("reports.view"),
  async (req: any, res) => {
    // NOTE: ensure the receipt belongs to this landlordId before exposing content
    res.type("html").send(`
      <h2>RentChain Receipt</h2>
      <p>Receipt ID: ${req.params.id}</p>
      <p>Status: Paid</p>
    `);
  }
);

export default router;
