import { db } from "../..//config/firebase";
import { canonicalize } from "../../lib/ledger/canonicalJson";
import { sha256Hex } from "../../lib/ledger/hash";
import {
  LedgerEventInput,
  LedgerEventStored,
  buildHashableEvent,
} from "../../lib/ledger/ledgerTypes";

const COLLECTION = "ledgerEvents";

export async function getLatestLedgerEvent(landlordId: string): Promise<LedgerEventStored | null> {
  if (!landlordId) return null;

  // Prefer seq ordering; if seq not present, ts will still work.
  const snap = await db
    .collection(COLLECTION)
    .where("landlordId", "==", landlordId)
    .orderBy("seq", "desc")
    .orderBy("ts", "desc")
    .limit(1)
    .get()
    .catch(async (err: any) => {
      // Fallback if seq is missing and index not available: try ts only.
      if (String(err?.message || "").toLowerCase().includes("index")) {
        return db
          .collection(COLLECTION)
          .where("landlordId", "==", landlordId)
          .orderBy("ts", "desc")
          .limit(1)
          .get();
      }
      throw err;
    });

  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) } as LedgerEventStored;
}

export async function appendLedgerEvent(input: LedgerEventInput): Promise<LedgerEventStored> {
  if (!input?.landlordId) throw new Error("appendLedgerEvent: landlordId required");
  if (!input?.actor?.userId) throw new Error("appendLedgerEvent: actor.userId required");
  if (!input?.actor?.role) throw new Error("appendLedgerEvent: actor.role required");
  if (!input?.type) throw new Error("appendLedgerEvent: type required");
  if (typeof input?.ts !== "number") throw new Error("appendLedgerEvent: ts required");

  const latest = await getLatestLedgerEvent(input.landlordId);
  const prevHash = latest?.hash ?? null;
  const seq = (latest?.seq ?? 0) + 1;

  const payloadHash = sha256Hex(canonicalize(input.payload));
  const hashable = buildHashableEvent({
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    actor: input.actor,
    type: input.type,
    version: 1 as const,
    ts: input.ts,
    seq,
    prevHash,
    payloadHash,
  });
  const hash = sha256Hex(canonicalize(hashable));

  const doc = {
    ...input,
    version: 1 as const,
    seq,
    prevHash,
    payloadHash,
    hash,
    integrity: { status: "unverified" as const },
  };

  const ref = await db.collection(COLLECTION).add(doc);
  return { id: ref.id, ...(doc as any) } as LedgerEventStored;
}

export async function verifyLedgerChain(
  landlordId: string,
  limit = 500
): Promise<{ ok: boolean; checked: number; brokenAt?: string; reason?: string }> {
  if (!landlordId) return { ok: false, checked: 0, reason: "Missing landlordId" };

  const snap = await db
    .collection(COLLECTION)
    .where("landlordId", "==", landlordId)
    .orderBy("seq", "asc")
    .orderBy("ts", "asc")
    .limit(limit)
    .get()
    .catch(async (err: any) => {
      if (String(err?.message || "").toLowerCase().includes("index")) {
        return db
          .collection(COLLECTION)
          .where("landlordId", "==", landlordId)
          .orderBy("ts", "asc")
          .limit(limit)
          .get();
      }
      throw err;
    });

  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as LedgerEventStored));
  let prevHash: string | null = null;
  let checked = 0;

  for (const ev of docs) {
    checked += 1;
    const recomputedPayloadHash = sha256Hex(canonicalize(ev.payload));
    if (recomputedPayloadHash !== ev.payloadHash) {
      return { ok: false, checked, brokenAt: ev.id, reason: "payloadHash mismatch" };
    }

    const hashable = buildHashableEvent({
      landlordId: ev.landlordId,
      propertyId: ev.propertyId,
      unitId: ev.unitId,
      tenantId: ev.tenantId,
      actor: ev.actor,
      type: ev.type,
      version: ev.version,
      ts: ev.ts,
      seq: ev.seq,
      prevHash: ev.prevHash,
      payloadHash: ev.payloadHash,
    });
    const recomputedHash = sha256Hex(canonicalize(hashable));
    if (recomputedHash !== ev.hash) {
      return { ok: false, checked, brokenAt: ev.id, reason: "hash mismatch" };
    }

    if (ev.prevHash !== prevHash) {
      const expected = prevHash ?? null;
      return { ok: false, checked, brokenAt: ev.id, reason: `prevHash mismatch (expected ${expected})` };
    }

    prevHash = ev.hash;
  }

  return { ok: true, checked };
}
