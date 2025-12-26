import { db } from "../config/firebase";

function now() {
  return Date.now();
}

export function currentPeriod(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function incrementUsage({
  landlordId,
  period,
  deltas,
}: {
  landlordId: string;
  period: string;
  deltas: Record<string, number>;
}) {
  const id = `${landlordId}_${period}`;
  const ref = db.collection("billing_usage").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as any) : {};
    const next: Record<string, number> = { ...(cur || {}) };
    Object.entries(deltas || {}).forEach(([k, v]) => {
      const prev = Number(cur?.[k] || 0);
      next[k] = prev + Number(v || 0);
    });
    tx.set(
      ref,
      {
        landlordId,
        period,
        ...next,
        updatedAt: now(),
        createdAt: cur?.createdAt || now(),
      },
      { merge: true }
    );
  });
}

export async function getUsage(landlordId: string, period: string) {
  const id = `${landlordId}_${period}`;
  const snap = await db.collection("billing_usage").doc(id).get();
  if (!snap.exists) {
    return { landlordId, period, unitsCount: 0, screeningsCount: 0, other: {}, createdAt: null, updatedAt: null };
  }
  return snap.data() as any;
}
