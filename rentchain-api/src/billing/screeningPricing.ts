export type ScreeningTier = "basic" | "verify" | "verify_ai";
export type ScreeningAddon = "credit_score" | "expedited";

const TIER_BASE_AMOUNT_CENTS: Record<ScreeningTier, number> = {
  basic: 1999,
  verify: 2999,
  verify_ai: 3999,
};

const ADDON_AMOUNT_CENTS: Record<ScreeningAddon, number> = {
  credit_score: 499,
  expedited: 999,
};

export function getScreeningPricing(params: {
  screeningTier: ScreeningTier;
  addons?: string[];
  currency?: string;
}) {
  const tier = params.screeningTier;
  const addons = new Set((params.addons || []).filter(Boolean));
  const creditScoreAddOnCents = addons.has("credit_score")
    ? ADDON_AMOUNT_CENTS.credit_score
    : 0;
  const expeditedAddOnCents = addons.has("expedited")
    ? ADDON_AMOUNT_CENTS.expedited
    : 0;
  const baseAmountCents = TIER_BASE_AMOUNT_CENTS[tier];
  const totalAmountCents = baseAmountCents + creditScoreAddOnCents + expeditedAddOnCents;
  const currency = String(params.currency || "CAD").toUpperCase();

  return {
    baseAmountCents,
    verifiedAddOnCents: 0,
    aiAddOnCents: 0,
    scoreAddOnCents: creditScoreAddOnCents,
    expeditedAddOnCents,
    totalAmountCents,
    currency,
  };
}
