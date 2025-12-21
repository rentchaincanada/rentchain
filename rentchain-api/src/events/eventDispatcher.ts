// src/events/eventDispatcher.ts

import { firestore } from "../config/firebase";
import { DomainEventInput, BaseDomainEvent } from "./domainEvents";
import * as blockchain from "../blockchain";

/**
 * Simple ID generator so we don't add extra deps.
 */
function generateEventId(): string {
  return (
    "evt_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 10)
  );
}

/**
 * Deep-ish cleanup: remove undefined values from a shallow object,
 * and from its nested plain-object children.
 */
function cleanObject(
  obj?: Record<string, any>
): Record<string, any> | undefined {
  if (!obj) return undefined;

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const nested = cleanObject(value as Record<string, any>);
      if (nested && Object.keys(nested).length > 0) {
        cleaned[key] = nested;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Normalize and sanitize event data before persisting.
 */
function buildDomainEvent(input: DomainEventInput): BaseDomainEvent {
  const nowIso = new Date().toISOString();

  const event: BaseDomainEvent = {
    id: input.id || generateEventId(),
    type: input.type,
    timestamp: input.timestamp || nowIso,
    source: input.source,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    correlationId: input.correlationId,
    metadata: cleanObject(input.metadata),
    payload: cleanObject(input.payload),
  };

  // Remove any remaining undefined at the top level
  Object.keys(event).forEach((key) => {
    // @ts-ignore
    if (event[key] === undefined) {
      // @ts-ignore
      delete event[key];
    }
  });

  return event;
}

/**
 * Record a domain event into the unified `events` collection
 * and optionally dispatch it to the blockchain writer.
 */
export async function recordDomainEvent(
  input: DomainEventInput
): Promise<BaseDomainEvent> {
  const event = buildDomainEvent(input);

  // 1) Firestore
  try {
    if (!firestore) {
      console.warn(
        "[EventDispatcher] Firestore not configured, skipping persistence for event:",
        {
          id: event.id,
          type: event.type,
          source: event.source,
        }
      );
    } else {
      const docId = event.id;
      await firestore.collection("events").doc(docId).set(event, {
        merge: true,
      });
      console.log("[EventDispatcher] Event persisted to Firestore:", docId);
    }
  } catch (err) {
    console.error("[EventDispatcher] Failed to persist event:", err);
  }

  // 2) Blockchain (safe attempt)
  try {
    const anyBlockchain: any = blockchain;
    const fn =
      anyBlockchain.recordEventOnBlockchain || anyBlockchain.default || null;

    if (typeof fn === "function") {
      await fn(event);
    } else {
      console.log(
        "[EventDispatcher] Blockchain module not configured with recordEventOnBlockchain; skipping on-chain record for event:",
        event.id
      );
    }
  } catch (err) {
    console.error(
      "[EventDispatcher] Failed to record event on blockchain:",
      err
    );
  }

  return event;
}
