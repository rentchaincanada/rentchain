// src/routes/tenantBalanceRoutes.ts
import { Router, Request, Response } from "express";
import { getTenantBalance } from "../services/tenantBalanceService";
import {
  buildTenantFinancialProjectionMetadata,
  projectTenantBalanceSummary,
} from "../services/tenantPortal/tenantFinancialProjectionService";

const router = Router();

/**
 * GET /tenant-balance/:tenantId
 *
 * Returns the computed balance summary for a tenant.
 */
router.get(
  "/:tenantId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }

      const summary = await getTenantBalance(tenantId);
      const metadata = buildTenantFinancialProjectionMetadata({
        projectionName: "tenant_safe_balance_projection",
        scopeType: "tenant_balance",
        sourceCollections: ["events"],
        relationshipBasis: "Balance projection must be derived from the requested tenant financial event scope.",
      });
      res.json({
        ...metadata,
        ...projectTenantBalanceSummary(summary),
      });
    } catch (err) {
      console.error("[GET /tenant-balance/:tenantId] error", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        error: "Failed to compute tenant balance",
        detail: message,
      });
    }
  }
);

export default router;
