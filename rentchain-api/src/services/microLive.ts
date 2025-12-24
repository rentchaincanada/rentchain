import { db } from "../config/firebase";

export function microLiveDefaultEnabled() {
  const v = String(process.env.MICRO_LIVE_DEFAULT ?? "false").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function getWriteAllowlist(): string[] {
  const raw = String(process.env.MICRO_LIVE_WRITE_ALLOWLIST ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function isMicroLiveEnabledForLandlord(landlordId: string): Promise<boolean> {
  if (!landlordId) return false;
  const snap = await db.collection("landlords").doc(landlordId).get();
  if (!snap.exists) return microLiveDefaultEnabled();
  const data = snap.data() as any;
  return Boolean(data?.flags?.microLive ?? microLiveDefaultEnabled());
}

export async function setMicroLiveForLandlord(landlordId: string, enabled: boolean, meta?: any) {
  if (!landlordId) return;
  const now = Date.now();
  await db
    .collection("landlords")
    .doc(landlordId)
    .set(
      {
        flags: { microLive: enabled },
        microLive: {
          enabled,
          updatedAt: now,
          ...(enabled ? { enabledAt: now } : {}),
          ...(meta ? { meta } : {}),
        },
        updatedAt: now,
      },
      { merge: true }
    );
}
