import { db } from "../config/firebase";
import { Account, PlanTier } from "../types/account";
import { entitlementsForPlan } from "./planDefaults";

const COLLECTION = "accounts";

/**
 * Simple model: Account id = landlordId.
 * This is perfect for Starter→Core upgrades without migrations.
 */
export async function getOrCreateAccount(landlordId: string): Promise<Account> {
  const ref = db.collection(COLLECTION).doc(landlordId);
  const snap = await ref.get();

  const now = new Date().toISOString();

  if (snap.exists) {
    const data = snap.data() as Account;
    return data;
  }

  const plan: PlanTier = "screening";

  const account: Account = {
    id: landlordId,
    ownerUserId: landlordId,
    plan,
    planStatus: "active",
    entitlements: entitlementsForPlan(plan),
    usage: {
      properties: 0,
      units: 0,
      screeningsThisMonth: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(account);
  return account;
}

/**
 * Optional: keep usage updated (call from places you already list properties/units).
 */
export async function setUsage(
  landlordId: string,
  patch: Partial<Account["usage"]>
) {
  const ref = db.collection(COLLECTION).doc(landlordId);
  const now = new Date().toISOString();
  await ref.set(
    {
      usage: patch,
      updatedAt: now,
    },
    { merge: true }
  );
}

/**
 * Upgrade plan (can be used later when billing is wired).
 */
export async function setPlan(landlordId: string, plan: PlanTier) {
  const ref = db.collection(COLLECTION).doc(landlordId);
  const now = new Date().toISOString();
  await ref.set(
    {
      plan,
      entitlements: entitlementsForPlan(plan),
      updatedAt: now,
    },
    { merge: true }
  );
}
