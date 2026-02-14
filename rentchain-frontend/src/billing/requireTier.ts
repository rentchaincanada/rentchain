export type TierKey = "starter" | "pro" | "business" | "elite";

const TIER_ORDER: Record<TierKey, number> = {
  starter: 0,
  pro: 1,
  business: 2,
  elite: 3,
};

export function normalizeTier(input?: string | null): TierKey {
  const value = String(input || "").trim().toLowerCase();
  if (value === "pro" || value === "professional") return "pro";
  if (value === "business" || value === "enterprise") return "business";
  if (value === "elite") return "elite";
  return "starter";
}

export function hasTier(userTier?: string | null, requiredTier: TierKey = "pro"): boolean {
  const current = normalizeTier(userTier);
  return TIER_ORDER[current] >= TIER_ORDER[requiredTier];
}

export function assertTier(userTier?: string | null, requiredTier: TierKey = "pro"): boolean {
  return hasTier(userTier, requiredTier);
}
