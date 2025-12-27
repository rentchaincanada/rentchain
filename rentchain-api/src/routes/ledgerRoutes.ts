// @ts-nocheck
import { Router } from "express";
import { getLedgerEvents } from "../services/ledgerEventsService";

const router = Router();

// GET /api/ledger (optional tenantId/propertyId/limit)
router.get("/", async (req, res) => {
  const { tenantId, propertyId, limit } = req.query as any;
  const parsedLimit = Number(limit) || 50;
  const events = await getLedgerEvents({
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    limit: parsedLimit,
  });
  res.json(events);
});

export default router;
