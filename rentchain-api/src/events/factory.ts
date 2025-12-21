// ----------------------------------------
// Event Factory
// ----------------------------------------

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import {
  Env,
  EventActor,
  EventContext,
  EventEnvelope,
  EventIntegrity,
  EventLinks,
} from "./types";

// Semantic version for all events created in this system
const EVENT_VERSION = "1.0.0";

// Return ISO timestamp in UTC
function isoNowUtc(): string {
  return new Date().toISOString();
}

// Canonical SHA-256 hash of a payload object (null-safe, stable key order)
export function hashPayload(payload: unknown): string {
  const hash = crypto.createHash("sha256");

  // Handle null / undefined explicitly
  if (payload == null) {
    hash.update("null");
    return hash.digest("hex");
  }

  // For primitives (string/number/boolean/etc.), just JSON-encode directly
  if (typeof payload !== "object") {
    hash.update(JSON.stringify(payload));
    return hash.digest("hex");
  }

  // For objects, normalize key order for deterministic hashing
  const obj = payload as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const normalized: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    normalized[key] = obj[key];
  }

  const json = JSON.stringify(normalized);
  hash.update(json);
  return hash.digest("hex");
}

// Options for createEvent()
interface CreateEventOptions<P = unknown> {
  eventType: string;
  payload?: P | null;          // ✅ allow optional/null payload
  actor: EventActor;
  context?: EventContext;
  links?: Partial<EventLinks>;
  env?: Env;
  previousEventHash?: string | null;
  nonce?: number;
}

// Main event factory function
export function createEvent<P = unknown>({
  eventType,
  payload,
  actor,
  context = {},
  links = {},
  env = process.env.NODE_ENV === "production" ? "prod" : "dev",
  previousEventHash = null,
  nonce = 1,
}: CreateEventOptions<P>): EventEnvelope<P | Record<string, never>> {
  // ✅ Normalize payload so we never store raw null/undefined
  const safePayload: P | Record<string, never> =
    (payload as P) ?? ({} as Record<string, never>);

  const payloadHash = hashPayload(safePayload);

  const integrity: EventIntegrity = {
    payloadHash,
    previousEventHash,
    signature: null, // blockchain adapter fills this later
    signingMethod: null,
    nonce,
  };

  const defaultLinks: EventLinks = {
    firestoreDocPath: null,
    apiEndpoint: null,
    onChainTxHash: null,
    explorerUrl: null,
    ...links,
  };

  const event: EventEnvelope<P | Record<string, never>> = {
    eventId: uuidv4(),
    eventType,
    version: EVENT_VERSION,
    timestamp: isoNowUtc(),
    env,
    actor,
    context,
    payload: safePayload,
    integrity,
    links: defaultLinks,
  };

  return event;
}
