import { DEMO_LANDLORD, DEMO_LANDLORD_EMAIL } from "../config/authConfig";
import { db } from "../config/firebase";

export interface LandlordProfile {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  plan?: string;
  planStartedAt?: string;
  role?: string;
  landlordId?: string;
}

const LANDLORD_PROFILES: Record<string, LandlordProfile> = {};

function seedDemo(): void {
  const id = DEMO_LANDLORD.id;
  if (LANDLORD_PROFILES[id]) return;
  const now = new Date().toISOString();
  LANDLORD_PROFILES[id] = {
    id,
    email: DEMO_LANDLORD_EMAIL,
    createdAt: now,
    updatedAt: now,
  };
}

seedDemo();

export function ensureLandlordProfile(
  id: string,
  email?: string | null
): LandlordProfile {
  const existing = LANDLORD_PROFILES[id];
  if (existing) {
    if (email && existing.email !== email) {
      existing.email = email;
      existing.updatedAt = new Date().toISOString();
    }
    return existing;
  }

  const now = new Date().toISOString();
  const profile: LandlordProfile = {
    id,
    email: email || "",
    createdAt: now,
    updatedAt: now,
  };
  LANDLORD_PROFILES[id] = profile;
  return profile;
}

export function getLandlordProfile(
  id: string
): LandlordProfile | undefined {
  return LANDLORD_PROFILES[id];
}

export async function getOrCreateLandlordProfile(input: {
  uid: string;
  email: string;
}): Promise<LandlordProfile> {
  const uid = input.uid;
  const fallbackEmail = input.email;
  const ref = db.collection("landlords").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = new Date().toISOString();
    const profile: LandlordProfile = {
      id: uid,
      landlordId: uid,
      email: fallbackEmail,
      createdAt: now,
      updatedAt: now,
      plan: "screening",
      planStartedAt: now,
      role: "landlord",
    };
    await ref.set(profile, { merge: true });
    return profile;
  }

  const data = snap.data() as any;
  return {
    id: data?.id || uid,
    landlordId: data?.landlordId || uid,
    email: data?.email || fallbackEmail,
    createdAt: data?.createdAt || data?.created_at || "",
    updatedAt: data?.updatedAt || data?.updated_at || "",
    plan: data?.plan || "screening",
    planStartedAt: data?.planStartedAt || data?.plan_started_at || null,
    role: data?.role || "landlord",
  };
}
