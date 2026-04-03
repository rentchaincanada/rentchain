export type TierKey = "starter" | "pro" | "elite";

const TIER_ORDER: Record<TierKey, number> = {
  starter: 0,
  pro: 1,
  elite: 2,
};

export function normalizeTier(input?: string | null): TierKey {
  const value = String(input || "").trim().toLowerCase();
  if (value === "pro" || value === "professional") return "pro";
  if (value === "business" || value === "elite" || value === "enterprise") return "elite";
  return "starter";
}

export function hasTier(userTier?: string | null, requiredTier: TierKey = "pro"): boolean {
  const current = normalizeTier(userTier);
  return TIER_ORDER[current] >= TIER_ORDER[requiredTier];
}

export function assertTier(userTier?: string | null, requiredTier: TierKey = "pro"): boolean {
  return hasTier(userTier, requiredTier);
}
