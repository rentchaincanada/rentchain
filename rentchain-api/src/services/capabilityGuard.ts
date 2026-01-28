import { db } from "../config/firebase";
import { CAPABILITIES, CapabilityKey, resolvePlanTier } from "../config/capabilities";

type CapabilityCheck =
  | { ok: true; plan: string }
  | { ok: false; plan: string; error: "forbidden" };

export async function requireCapability(
  landlordId: string,
  capability: CapabilityKey
): Promise<CapabilityCheck> {
  const snap = await db.collection("landlords").doc(landlordId).get();
  const plan = resolvePlanTier((snap.data() as any)?.plan || "screening");
  const allowed = CAPABILITIES[plan]?.[capability] === true;
  if (!allowed) {
    return { ok: false, plan, error: "forbidden" };
  }
  return { ok: true, plan };
}
