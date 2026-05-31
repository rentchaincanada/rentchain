// src/routes/tenantLedger.ts
import { Router, Request, Response } from "express";
import { getTenantLedger } from "../services/tenantLedgerService";
import {
  buildTenantFinancialProjectionMetadata,
  projectTenantLedgerItem,
} from "../services/tenantPortal/tenantFinancialProjectionService";

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
    const events = (await getTenantLedger(tenantId)).map((entry) => {
      const projected = projectTenantLedgerItem(entry);
      const amount = typeof projected.amountCents === "number" ? projected.amountCents / 100 : 0;
      return {
        ...projected,
        date: new Date(projected.occurredAt).toISOString(),
        amount: projected.type === "payment" ? -Math.abs(amount) : Math.abs(amount),
        description: projected.description || projected.title,
        balanceAfter: typeof entry.runningBalance === "number" ? entry.runningBalance : undefined,
      };
    });
    const metadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_ledger_projection",
      scopeType: "tenant_ledger",
      sourceCollections: ["ledgerEvents", "payments"],
      relationshipBasis: "Ledger projection must be derived from the requested tenant ledger scope.",
    });
    return res.json({ ...metadata, events });
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
