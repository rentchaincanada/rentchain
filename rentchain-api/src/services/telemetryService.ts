import crypto from "crypto";
import { db } from "../config/firebase";

function nowMs() {
  return Date.now();
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableKey(name: string, dims?: Record<string, string | number | boolean | null | undefined>) {
  const entries = Object.entries(dims || {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v ?? "")] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return `${name}|${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export async function logEvent(params: { type: string; landlordId?: string | null; actor?: string | null; meta?: any }) {
  const { type, landlordId, actor, meta } = params;
  const ts = nowMs();
  await db.collection("telemetry_events").add({
    type,
    landlordId: landlordId || null,
    actor: actor || null,
    meta: meta || null,
    ts,
    day: dayKey(ts),
    createdAt: ts,
  });
}

export async function incrementCounter(params: { name: string; dims?: Record<string, any>; amount?: number }) {
  const { name, dims, amount } = params;
  const amt = Number.isFinite(amount) ? Number(amount) : 1;
  const dKey = dayKey();
  const counterKey = stableKey(name, dims);
  const id = `${dKey}_${sha256(counterKey).slice(0, 20)}`;
  const ref = db.collection("telemetry_counters").doc(id);
  const ts = nowMs();

  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data() as any) : {};
    const current = Number(prev?.value || 0);
    tx.set(
      ref,
      {
        id,
        day: dKey,
        name,
        dims: dims || {},
        key: counterKey,
        value: current + amt,
        updatedAt: ts,
        createdAt: prev?.createdAt || ts,
      },
      { merge: true }
    );
  });
}

export async function getCountersSummary(days: number) {
  const n = Math.min(Math.max(Number(days) || 7, 1), 60);
  const today = new Date();
  const daysList: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    dt.setUTCDate(dt.getUTCDate() - i);
    daysList.push(dayKey(dt.getTime()));
  }

  const docs: any[] = [];
  for (let i = 0; i < daysList.length; i += 10) {
    const chunk = daysList.slice(i, i + 10);
    const s = await db.collection("telemetry_counters").where("day", "in", chunk).get();
    docs.push(...s.docs.map((d) => d.data()));
  }

  const byName: Record<string, number> = {};
  for (const d of docs) {
    const name = String(d?.name || "unknown");
    const v = Number(d?.value || 0);
    byName[name] = (byName[name] || 0) + v;
  }

  return { days: n, byName, raw: docs };
}
