// rentchain-api/src/services/chainHeadUpdateService.ts
import {
  buildBlockchainFromLedgerEvents,
  LedgerLikeEvent,
} from "../blockchain";
import { getTenantDetailBundle } from "./tenantDetailsService";
import { saveChainHeadSnapshot } from "./chainHeadService";

/**
 * Rebuilds the blockchain for a single tenant's ledger
 * and saves a fresh chain head snapshot.
 */
export async function updateChainHeadForTenant(tenantId: string) {
  if (!tenantId) return;

  const bundle = await getTenantDetailBundle(tenantId);
  const ledger = bundle.ledger || [];

  if (!ledger.length) return;

  const tenantInfo = bundle.tenant || {};
  const lease: any = (bundle as any).lease || {};

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
  if (!chain.length) return;

  const head = chain[chain.length - 1];

  await saveChainHeadSnapshot({
    tenantId,
    blockHeight: head.index,
    rootHash: head.hash,
    eventId: head.eventId,
  });
}
