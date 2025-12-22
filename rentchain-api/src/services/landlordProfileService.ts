import { DEMO_LANDLORD, DEMO_LANDLORD_EMAIL } from "../config/authConfig";
import { db } from "../config/firebase";

export interface LandlordProfile {
  id: string;
  email: string;
  screeningCredits: number;
  createdAt: string;
  updatedAt: string;
  plan?: string;
  role?: string;
  landlordId?: string;
}

const DEFAULT_CREDITS =
  Number(process.env.DEMO_SCREENING_CREDITS) > 0
    ? Number(process.env.DEMO_SCREENING_CREDITS)
    : 3;

const LANDLORD_PROFILES: Record<string, LandlordProfile> = {};

function seedDemo(): void {
  const id = DEMO_LANDLORD.id;
  if (LANDLORD_PROFILES[id]) return;
  const now = new Date().toISOString();
  LANDLORD_PROFILES[id] = {
    id,
    email: DEMO_LANDLORD_EMAIL,
    screeningCredits: DEFAULT_CREDITS,
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
    screeningCredits: DEFAULT_CREDITS,
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

export function decrementScreeningCredit(options: {
  landlordId: string;
  email?: string | null;
}): { ok: boolean; profile?: LandlordProfile } {
  const profile = ensureLandlordProfile(options.landlordId, options.email);
  if (!profile || profile.screeningCredits <= 0) {
    return { ok: false };
  }
  profile.screeningCredits = Math.max(0, profile.screeningCredits - 1);
  profile.updatedAt = new Date().toISOString();
  return { ok: true, profile };
}

export function setScreeningCredits(
  landlordId: string,
  credits: number
): LandlordProfile | undefined {
  const profile = ensureLandlordProfile(landlordId);
  profile.screeningCredits = Math.max(0, Math.floor(credits));
  profile.updatedAt = new Date().toISOString();
  return profile;
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
      screeningCredits: 0,
      createdAt: now,
      updatedAt: now,
      plan: "starter",
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
    screeningCredits: data?.screeningCredits ?? 0,
    createdAt: data?.createdAt || data?.created_at || "",
    updatedAt: data?.updatedAt || data?.updated_at || "",
    plan: data?.plan || "starter",
    role: data?.role || "landlord",
  };
}
