// src/events/envelope.ts
import { v4 as uuidv4 } from "uuid";

export interface LedgerEvent<T = any> {
  eventId: string;
  eventType: string;
  version: number;
  timestamp: string;
  actor: {
    system: string;
    userId?: string;
  };
  data: T;
  meta: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
    blockchain?: {
      txHash?: string;
      status: "pending" | "confirmed" | "failed";
    };
  };
}

export function createLedgerEvent<T>(
  eventType: string,
  data: T,
  actor: { system: string; userId?: string },
  meta: Partial<LedgerEvent["meta"]> = {}
): LedgerEvent<T> {
  return {
    eventId: uuidv4(),
    eventType,
    version: 1,
    timestamp: new Date().toISOString(),
    actor,
    data,
    meta: {
      blockchain: { status: "pending" },
      ...meta,
    },
  };
}
