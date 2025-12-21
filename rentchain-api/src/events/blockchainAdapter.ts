// src/events/blockchainAdapter.ts
//
// For now, this is just a stub that *could* send envelopes to a chain.
// We keep the interface simple so we can swap in a real implementation later.

import type { EventEnvelope } from "./blockchainEnvelope";

export interface BlockchainResult {
  success: boolean;
  network?: string;
  txId?: string;
  anchoredAt?: string;
  error?: string;
}

export async function anchorEnvelopeOnChain(
  envelope: EventEnvelope
): Promise<BlockchainResult> {
  // 🚧 PHASE 1: no real chain call yet.
  // Just simulate success and log.
  console.log(
    "[BlockchainAdapter] (simulated) anchor envelope",
    envelope.envelopeId,
    "hash=",
    envelope.hash.contentHash
  );

  // In the future, call your chain client here and return txId, etc.
  return {
    success: true,
    network: "simulated-local",
    txId: `simulated-${envelope.envelopeId}`,
    anchoredAt: new Date().toISOString(),
  };
}
