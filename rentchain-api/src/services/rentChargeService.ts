// src/services/rentChargeService.ts
import { firestore } from "../events/firestore";
import {
  createEventEnvelope,
  type StreamType,
} from "../events/blockchainEnvelope";

export interface RentChargeInput {
  tenantId: string;
  leaseId?: string | null;
  amount: number | string;
  period?: string | null;   // e.g. "2025-12"
  dueDate?: string | null;  // "YYYY-MM-DD"
  description?: string | null;
}

function toNumberOrThrow(value: number | string): number {
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new Error("Amount is NaN");
    }
    return value;
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  return n;
}

async function getLatestHashForTenant(tenantId: string): Promise<string | null> {
  const snap = await firestore
    .collection("events")
    .where("tenantId", "==", tenantId)
    .get();

  let prevHash: string | null = null;
  let latestTs = 0;

  snap.forEach((doc) => {
    const data = doc.data() as any;
    const ts =
      typeof data.timestamp === "number"
        ? data.timestamp
        : typeof data.timestamp === "string"
        ? Number(data.timestamp)
        : 0;

    if (ts > latestTs && data.hash?.contentHash) {
      latestTs = ts;
      prevHash = data.hash.contentHash;
    }
  });

  return prevHash;
}

/**
 * Record a rent charge for a tenant as a RentCharged blockchain-ready event.
 */
export async function recordRentCharge(input: RentChargeInput) {
  const amount = toNumberOrThrow(input.amount);
  if (amount <= 0) {
    throw new Error("Amount must be > 0");
  }

  const tenantId = input.tenantId;
  const leaseId = input.leaseId ?? null;

  // Derive period (YYYY-MM)
  let period = input.period ?? null;
  let baseDate: Date;

  if (input.dueDate) {
    const parsed = Date.parse(input.dueDate);
    baseDate = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  } else {
    baseDate = new Date();
  }

  if (!period) {
    const y = baseDate.getFullYear();
    const m = (baseDate.getMonth() + 1).toString().padStart(2, "0");
    period = `${y}-${m}`;
  }

  // Derive dueDate if missing → first of period month
  let dueDate = input.dueDate ?? null;
  if (!dueDate && period) {
    const [yStr, mStr] = period.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const d = new Date(y, m - 1, 1);
      dueDate = d.toISOString().slice(0, 10);
    }
  }

  const streamType: StreamType = "tenant";
  const eventType = "RentCharged";

  const prevHash = await getLatestHashForTenant(tenantId);

  const envelope = createEventEnvelope({
    streamType,
    streamId: tenantId,
    eventType,
    payload: {
      tenantId,
      leaseId,
      amount,
      period,
      dueDate,
      description: input.description ?? null,
    },
    metadata: {
      source: "charges/manual",
    },
    prevHash,
  });

  // Use dueDate as the event timestamp if available, otherwise now
  let ts: number = Date.now();
  if (dueDate) {
    const parsed = Date.parse(dueDate);
    if (!Number.isNaN(parsed)) {
      ts = parsed;
    }
  }

  await firestore
    .collection("events")
    .doc(envelope.envelopeId)
    .set({
      ...envelope,
      tenantId,
      type: eventType,
      timestamp: ts,
    });

  return {
    eventId: envelope.envelopeId,
    tenantId,
    leaseId,
    period,
    dueDate,
    amount,
    envelope,
  };
}
