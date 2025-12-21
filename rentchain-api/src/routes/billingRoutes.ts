import express from "express";
import { listBillingRecords } from "../billing/billingService";

const router = express.Router();

router.get("/", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const records = await listBillingRecords(landlordId);
  res.json(records);
});

router.get("/receipts/:id", async (req, res) => {
  res.type("html").send(`
    <h2>RentChain Receipt</h2>
    <p>Receipt ID: ${req.params.id}</p>
    <p>Status: Paid</p>
  `);
});

export default router;
