import { db } from "../config/firebase";
import { resolvePlanTier } from "../config/capabilities";

type ResolveSource = "landlordDoc" | "tokenFallback";

export type ResolvedLandlordTier = {
  landlordIdResolved: string | null;
  landlordDocId: string | null;
  landlordPlan: string | null;
  tier: ReturnType<typeof resolvePlanTier>;
  source: ResolveSource;
};

async function loadLandlordDocById(id: string) {
  const snap = await db.collection("landlords").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() as any };
}

async function loadLandlordDocByEmail(email: string) {
  const snap = await db.collection("landlords").where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() as any };
}

async function loadLandlordDocByOwnerUid(ownerUid: string) {
  const snap = await db.collection("landlords").where("ownerUid", "==", ownerUid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() as any };
}

export async function resolveLandlordAndTier(user: any): Promise<ResolvedLandlordTier> {
  const tokenPlan = resolvePlanTier(user?.plan);
  const landlordId = user?.landlordId || user?.id || null;
  const email = String(user?.email || "").trim();

  try {
    let resolved = landlordId ? await loadLandlordDocById(String(landlordId)) : null;
    if (!resolved && email) {
      resolved = await loadLandlordDocByEmail(email);
    }
    if (!resolved && user?.id) {
      resolved = await loadLandlordDocByOwnerUid(String(user.id));
    }

    if (resolved?.data?.plan) {
      const tier = resolvePlanTier(resolved.data.plan);
      return {
        landlordIdResolved: String(landlordId || resolved.id || ""),
        landlordDocId: resolved.id,
        landlordPlan: String(resolved.data.plan || ""),
        tier,
        source: "landlordDoc",
      };
    }
  } catch {
    // ignore lookup errors
  }

  return {
    landlordIdResolved: landlordId ? String(landlordId) : null,
    landlordDocId: null,
    landlordPlan: null,
    tier: tokenPlan,
    source: "tokenFallback",
  };
}
