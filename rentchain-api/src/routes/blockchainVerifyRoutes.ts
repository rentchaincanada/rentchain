// rentchain-api/src/routes/blockchainVerifyRoutes.ts
import { Router } from "express";
import { getLatestChainHead } from "../services/chainHeadService";
import {
  buildBlockchainFromLedgerEvents,
  LedgerLikeEvent,
} from "../blockchain";
import { getTenantDetailBundle } from "../services/tenantDetailsService";

const router = Router();

/**
 * GET /api/blockchain/verify
 *
 * Rebuilds the blockchain for the tenant referenced by the latest chain head
 * snapshot and compares height + root hash.
 */
router.get("/blockchain/verify", async (_req, res) => {
  try {
    const latest = await getLatestChainHead();

    if (!latest) {
      return res.status(200).json({
        ok: true,
        message: "No chain head snapshots exist yet.",
      });
    }

    const tenantId = (latest as any).tenantId as string | undefined;

    if (!tenantId) {
      return res.status(200).json({
        ok: false,
        reason:
          "Latest chain head snapshot does not include tenantId. Create a new snapshot with updated schema.",
        storedSnapshot: latest,
      });
    }

    const bundle = await getTenantDetailBundle(tenantId);
    const ledger = bundle.ledger || [];
    const tenantInfo = bundle.tenant || {};
    const lease: any = (bundle as any).lease || {};

    if (!ledger.length) {
      return res.status(200).json({
        ok: false,
        reason:
          "No ledger events found for tenant referenced by the latest chain head.",
        tenantId,
        storedSnapshot: latest,
      });
    }

    const tenantName =
      tenantInfo.fullName ||
      tenantInfo.name ||
      tenantInfo.legalName ||
      "Unknown tenant";

    const propertyName =
      tenantInfo.propertyName || lease.propertyName || "Unknown property";

    const unit =
      tenantInfo.unit ||
      tenantInfo.unitNumber ||
      lease.unit ||
      null;

    const events: LedgerLikeEvent[] = ledger.map((entry: any) => ({
      id: entry.id ?? null,
      type: entry.type ?? "Unknown",
      date: entry.date ?? null,
      tenantId,
      tenantName,
      propertyName,
      unit,
      amount: entry.amount ?? null,
      method: entry.method ?? null,
      notes: entry.notes ?? null,
    }));

    const chain = buildBlockchainFromLedgerEvents(events);

    if (!chain.length) {
      return res.status(200).json({
        ok: false,
        reason:
          "Failed to build blockchain for the referenced tenant (no events after normalization).",
        tenantId,
      });
    }

    const head = chain[chain.length - 1];

    const expectedHeight = (latest as any).blockHeight;
    const expectedHash = (latest as any).rootHash;

    if (head.hash !== expectedHash) {
      return res.status(200).json({
        ok: false,
        reason: "Blockchain hash mismatch",
        expected: expectedHash,
        actual: head.hash,
        tenantId,
        storedSnapshot: latest,
      });
    }

    if (head.index !== expectedHeight) {
      return res.status(200).json({
        ok: false,
        reason: "Blockchain height mismatch",
        expected: expectedHeight,
        actual: head.index,
        tenantId,
        storedSnapshot: latest,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Blockchain integrity verified for latest chain head tenant.",
      tenantId,
      blockHeight: head.index,
      rootHash: head.hash,
    });
  } catch (err: any) {
    console.error("[GET /api/blockchain/verify] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Verification failed",
    });
  }
});

export default router;
