// src/routes/tenantLedger.ts
import { Router, Request, Response } from "express";
import { getTenantLedger } from "../services/tenantLedgerService";

const router = Router();

/**
 * GET /tenantLedger/:tenantId
 */
router.get("/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId is required" });
  }

  try {
    const events = await getTenantLedger(tenantId);
    return res.json({ tenantId, events });
  } catch (err) {
    console.error("[GET /tenantLedger/:tenantId] error", err);
    const message =
      err instanceof Error ? err.message : "Unknown Firestore error";
    return res
      .status(500)
      .json({ error: "Failed to fetch tenant ledger", detail: message });
  }
});

export default router;
