// rentchain-api/src/blockchain.ts
import crypto from "crypto";

export interface LedgerLikeEvent {
  id: string | null;
  type: string;
  date: string | null;
  tenantId: string | null;
  tenantName?: string | null;
  propertyName?: string | null;
  unit?: string | null;
  amount?: number | null;
  method?: string | null;
  notes?: string | null;
}

export interface BlockchainBlock {
  index: number;
  eventId: string | null;
  type: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyName: string | null;
  unit: string | null;
  amount: number | null;
  method: string | null;
  notes: string | null;

  timestamp: string; // ISO
  eventDate: string | null;

  payloadHash: string;
  prevHash: string;
  hash: string;
}

/**
 * Simple SHA-256 helper.
 */
function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Build a deterministic blockchain from a list of ledger-like events.
 * - Events are sorted by date (oldest → newest), then by id as tiebreaker.
 * - Each block hashes its payload + prevHash.
 */
export function buildBlockchainFromLedgerEvents(
  events: LedgerLikeEvent[]
): BlockchainBlock[] {
  if (!events || events.length === 0) {
    return [];
  }

  // Sort: oldest first (so chain builds in chronological order)
  const sorted = [...events].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;

    if (da !== db) return da - db;

    const ida = a.id ?? "";
    const idb = b.id ?? "";
    return ida.localeCompare(idb);
  });

  const blocks: BlockchainBlock[] = [];
  let prevHash = "GENESIS";

  sorted.forEach((evt, index) => {
    const payload = {
      id: evt.id ?? null,
      type: evt.type,
      date: evt.date ?? null,
      tenantId: evt.tenantId ?? null,
      tenantName: evt.tenantName ?? null,
      propertyName: evt.propertyName ?? null,
      unit: evt.unit ?? null,
      amount: evt.amount ?? null,
      method: evt.method ?? null,
      notes: evt.notes ?? null,
    };

    const payloadString = JSON.stringify(payload);
    const payloadHash = sha256(payloadString);

    const blockInput = JSON.stringify({
      index,
      payloadHash,
      prevHash,
    });

    const hash = sha256(blockInput);

    const block: BlockchainBlock = {
      index,
      eventId: evt.id ?? null,
      type: evt.type,
      tenantId: evt.tenantId ?? null,
      tenantName: (evt.tenantName as string | null) ?? null,
      propertyName: (evt.propertyName as string | null) ?? null,
      unit: (evt.unit as string | null) ?? null,
      amount: evt.amount ?? null,
      method: evt.method ?? null,
      notes: evt.notes ?? null,

      timestamp: new Date().toISOString(),
      eventDate: evt.date ?? null,

      payloadHash,
      prevHash,
      hash,
    };

    blocks.push(block);
    prevHash = hash;
  });

  return blocks;
}

// Simple stub writer for audit/on-chain payloads
type OnChainPayload = {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  tenantId?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  paymentId?: string | null;
  timestamp: string;
  summary: string;
  meta?: Record<string, any> | null;
};

export async function writeEventToChain(
  payload: OnChainPayload
): Promise<{ txHash: string }> {
  const fakeTxHash = `0xstub-${payload.id.slice(0, 8)}-${Date.now().toString(
    16
  )}`;
  console.log("[blockchain.ts] writeEventToChain (stub)", {
    txHash: fakeTxHash,
    payload,
  });
  return { txHash: fakeTxHash };
}
