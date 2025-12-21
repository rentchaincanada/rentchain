// src/events/blockchainEnvelope.ts
//
// Canonical blockchain-ready envelope for all domain events.
// This does NOT talk to a blockchain yet – it just produces
// a stable, hashable object that we can later anchor on-chain.

import crypto from "crypto";

export type StreamType = "tenant" | "property" | "portfolio" | "system";

export interface EventMetadata {
  source: string; // e.g. "api/payments", "ai/tenant-risk"
  correlationId?: string;
  causationId?: string;
  userId?: string; // which user/landlord triggered it
  ipAddress?: string;
  [key: string]: any;
}

export interface EventEnvelope<TPayload = any> {
  // Identity
  envelopeId: string; // UUID or Firestore doc id
  envelopeVersion: number; // for future evolution

  // Stream info
  streamType: StreamType; // "tenant" | "property" | etc.
  streamId: string; // e.g. tenantId

  // Domain event info
  eventType: string; // e.g. "RentPaymentRecorded"
  occurredAt: string; // ISO 8601
  recordedAt: string; // ISO 8601
  payload: TPayload;

  // Metadata (who/where/why)
  metadata: EventMetadata;

  // Blockchain / integrity fields
  hash: {
    algorithm: "sha256";
    contentHash: string; // hash of core fields
    prevHash?: string | null; // previous event in this stream
  };

  // Optional future on-chain info (still off-chain now)
  chain?: {
    network?: string; // e.g. "polygon-amoy"
    txId?: string;
    anchoredAt?: string; // ISO
  };
}

/**
 * Fields used to compute the hash. Keeping this stable is critical.
 */
function buildHashInput<TPayload>(
  envelope: Omit<EventEnvelope<TPayload>, "hash" | "chain">
) {
  return JSON.stringify({
    envelopeVersion: envelope.envelopeVersion,
    streamType: envelope.streamType,
    streamId: envelope.streamId,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    recordedAt: envelope.recordedAt,
    payload: envelope.payload,
    metadata: envelope.metadata,
  });
}

/**
 * Compute a SHA-256 hash for deterministic integrity.
 */
function computeContentHash<TPayload>(
  envelope: Omit<EventEnvelope<TPayload>, "hash" | "chain">
): string {
  const input = buildHashInput(envelope);
  return crypto.createHash("sha256").update(input).digest("hex");
}

export interface CreateEnvelopeOptions<TPayload> {
  streamType: StreamType;
  streamId: string;
  eventType: string;
  payload: TPayload;
  metadata?: Partial<EventMetadata>;
  envelopeId?: string; // if you want to control it, otherwise auto
  occurredAt?: string; // if not provided, uses now
  prevHash?: string | null; // last hash in this tenant stream
}

/**
 * Factory to build a blockchain-ready envelope for any event.
 */
export function createEventEnvelope<TPayload>(
  opts: CreateEnvelopeOptions<TPayload>
): EventEnvelope<TPayload> {
  const nowIso = new Date().toISOString();

  const base: Omit<EventEnvelope<TPayload>, "hash" | "chain"> = {
    envelopeId:
      opts.envelopeId ??
      crypto.randomUUID?.() ??
      `env_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    envelopeVersion: 1,

    streamType: opts.streamType,
    streamId: opts.streamId,

    eventType: opts.eventType,
    occurredAt: opts.occurredAt ?? nowIso,
    recordedAt: nowIso,
    payload: opts.payload,

    metadata: {
      source: "api",
      ...opts.metadata,
    },
  };

  const contentHash = computeContentHash(base);

  return {
    ...base,
    hash: {
      algorithm: "sha256",
      contentHash,
      prevHash: opts.prevHash ?? null,
    },
    chain: {}, // empty for now – future on-chain info
  };
}
