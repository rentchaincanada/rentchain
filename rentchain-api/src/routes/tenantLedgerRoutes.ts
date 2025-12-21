// src/routes/tenantLedgerRoutes.ts
import express, { Request, Response } from "express";
import { getLedgerForTenant } from "../services/tenantLedgerService";

const router = express.Router();

/**
 * GET /tenantLedger/:tenantId
 * Returns derived ledger events for a tenant
 */
router.get("/tenantLedger/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const ledger = getLedgerForTenant(tenantId);
    res.json(ledger);
  } catch (err) {
    console.error("[TenantLedger] Failed to load ledger", err);
    res.status(500).json({ error: "Failed to load tenant ledger" });
  }
});

export default router;
