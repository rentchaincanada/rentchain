import { db } from "../config/firebase";
import { CAPABILITIES, type CapabilityKey, resolvePlanTier } from "../config/capabilities";

export type EntitlementsRole = "admin" | "landlord" | "tenant" | string;
export type EntitlementsPlan = "starter" | "pro" | "business" | "elite";

export type UserEntitlements = {
  userId: string;
  role: EntitlementsRole;
  plan: EntitlementsPlan;
  capabilities: CapabilityKey[];
  landlordId: string | null;
};

type ResolveHints = {
  claimsRole?: string | null;
  claimsPlan?: string | null;
  landlordIdHint?: string | null;
  emailHint?: string | null;
  requestCache?: Record<string, UserEntitlements> | null;
};

const ALL_CAPABILITIES = Object.keys(CAPABILITIES.business) as CapabilityKey[];

function sortedCapabilities(caps: Iterable<CapabilityKey>): CapabilityKey[] {
  return Array.from(new Set(caps)).sort();
}

function normalizeRole(input?: string | null): EntitlementsRole {
  const role = String(input || "").trim().toLowerCase();
  if (!role) return "landlord";
  if (role === "owner") return "admin";
  return role;
}

function normalizePlan(input?: string | null): EntitlementsPlan {
  const plan = String(input || "").trim().toLowerCase();
  if (plan === "pro") return "pro";
  if (plan === "business" || plan === "enterprise") return "business";
  if (plan === "elite") return "elite";
  return "starter";
}

async function loadLandlordPlan(params: {
  landlordId?: string | null;
  userId: string;
  email?: string | null;
}): Promise<{ landlordId: string | null; planRaw: string | null }> {
  const byId = String(params.landlordId || "").trim();
  if (byId) {
    const snap = await db.collection("landlords").doc(byId).get();
    if (snap.exists) {
      return { landlordId: byId, planRaw: String((snap.data() as any)?.plan || "") || null };
    }
  }

  const byUserId = String(params.userId || "").trim();
  if (byUserId) {
    const snap = await db.collection("landlords").doc(byUserId).get();
    if (snap.exists) {
      return { landlordId: byUserId, planRaw: String((snap.data() as any)?.plan || "") || null };
    }
  }

  const email = String(params.email || "").trim().toLowerCase();
  if (email) {
    const snap = await db.collection("landlords").where("email", "==", email).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { landlordId: doc.id, planRaw: String((doc.data() as any)?.plan || "") || null };
    }
  }

  return { landlordId: byId || byUserId || null, planRaw: null };
}

export async function getUserEntitlements(
  userId: string,
  hints: ResolveHints = {}
): Promise<UserEntitlements> {
  const cleanUserId = String(userId || "").trim();
  const cacheKey = cleanUserId ? `entitlements:${cleanUserId}` : "";
  if (cacheKey && hints.requestCache?.[cacheKey]) {
    return hints.requestCache[cacheKey];
  }
  if (!cleanUserId) {
    const empty: UserEntitlements = {
      userId: "",
      role: "landlord",
      plan: "starter",
      capabilities: [],
      landlordId: null,
    };
    if (cacheKey && hints.requestCache) hints.requestCache[cacheKey] = empty;
    return empty;
  }

  const userSnap = await db.collection("users").doc(cleanUserId).get();
  const user = userSnap.exists ? (userSnap.data() as any) : {};

  const role = normalizeRole(user?.role ?? hints.claimsRole);
  const landlordIdHint = String(user?.landlordId || hints.landlordIdHint || "").trim() || null;
  const emailHint = String(user?.email || hints.emailHint || "").trim().toLowerCase() || null;
  const landlordContext = await loadLandlordPlan({
    landlordId: landlordIdHint,
    userId: cleanUserId,
    email: emailHint,
  });

  const planRaw =
    (landlordContext.planRaw && String(landlordContext.planRaw).trim()) ||
    (user?.plan && String(user.plan).trim()) ||
    (hints.claimsPlan && String(hints.claimsPlan).trim()) ||
    "";
  const plan = normalizePlan(planRaw);

  if (role === "admin") {
    const adminEntitlements: UserEntitlements = {
      userId: cleanUserId,
      role,
      plan: "elite",
      capabilities: sortedCapabilities(ALL_CAPABILITIES),
      landlordId: landlordContext.landlordId || landlordIdHint || cleanUserId,
    };
    if (cacheKey && hints.requestCache) hints.requestCache[cacheKey] = adminEntitlements;
    return adminEntitlements;
  }

  const tier = resolvePlanTier(plan);
  const planCaps = CAPABILITIES[tier] || {};
  const capabilities: CapabilityKey[] = [];
  for (const [key, enabled] of Object.entries(planCaps)) {
    if (enabled) capabilities.push(key as CapabilityKey);
  }

  const entitlements: UserEntitlements = {
    userId: cleanUserId,
    role,
    plan,
    capabilities: sortedCapabilities(capabilities),
    landlordId: landlordContext.landlordId || landlordIdHint || (role === "landlord" ? cleanUserId : null),
  };
  if (cacheKey && hints.requestCache) hints.requestCache[cacheKey] = entitlements;
  return entitlements;
}

export async function getEntitlementsForLandlord(landlordId: string): Promise<UserEntitlements> {
  const cleanLandlordId = String(landlordId || "").trim();
  if (!cleanLandlordId) {
    return {
      userId: "",
      role: "landlord",
      plan: "starter",
      capabilities: [],
      landlordId: null,
    };
  }

  const snap = await db.collection("landlords").doc(cleanLandlordId).get();
  const rawPlan = snap.exists ? String((snap.data() as any)?.plan || "") : "";
  const plan = normalizePlan(rawPlan);
  const tier = resolvePlanTier(plan);
  const planCaps = CAPABILITIES[tier] || {};
  const capabilities: CapabilityKey[] = [];
  for (const [key, enabled] of Object.entries(planCaps)) {
    if (enabled) capabilities.push(key as CapabilityKey);
  }

  return {
    userId: cleanLandlordId,
    role: "landlord",
    plan,
    capabilities: sortedCapabilities(capabilities),
    landlordId: cleanLandlordId,
  };
}
