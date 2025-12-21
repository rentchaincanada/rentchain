// rentchain-api/src/routes/blockchainRoutes.ts
import { Router } from "express";
import {
  getTenantsList,
  getTenantDetailBundle,
} from "../services/tenantDetailsService";
import {
  buildBlockchainFromLedgerEvents,
  LedgerLikeEvent,
} from "../blockchain";

const router = Router();

/**
 * GET /api/blockchain
 *
 * Builds a deterministic hash chain from all ledger events across all tenants.
 * This is a view over your existing ledger data – no extra writes.
 */
router.get("/blockchain", async (_req, res) => {
  try {
    const tenants = await getTenantsList();

    const allEvents: LedgerLikeEvent[] = [];

    for (const tenant of tenants) {
      const tenantId = tenant.id;
      if (!tenantId) continue;

      const bundle = await getTenantDetailBundle(tenantId);

      const ledger = bundle.ledger ?? [];
      const tenantInfo = bundle.tenant ?? {};
      const lease = (bundle as any).lease ?? {};

      const tenantName =
        tenantInfo.fullName ||
        tenantInfo.name ||
        tenantInfo.legalName ||
        tenant.fullName ||
        tenant.name ||
        "Unknown tenant";

      const propertyName =
        tenantInfo.propertyName ?? lease.propertyName ?? "Unknown property";

      const unit =
        tenantInfo.unit ??
        lease.unit ??
        tenantInfo.unitNumber ??
        null;

      for (const entry of ledger) {
        allEvents.push({
          id: entry.id ?? null,
          type: entry.type ?? "Unknown",
          date: entry.date ?? null,
          tenantId,
          tenantName,
          propertyName,
          unit: unit ?? null,
          amount: entry.amount ?? null,
          method: entry.method ?? null,
          notes: entry.notes ?? null,
        });
      }
    }

    const chain = buildBlockchainFromLedgerEvents(allEvents);

    return res.status(200).json({
      length: chain.length,
      blocks: chain,
    });
  } catch (err: any) {
    console.error("[GET /api/blockchain] error:", err);
    return res.status(500).json({
      error: err?.message ?? "Failed to build blockchain view",
    });
  }
});

export default router;
