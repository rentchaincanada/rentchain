import { calculateScreeningPrice, normalizeScreeningAddonsV2 } from "../lib/screeningMonetizationV2/calculateScreeningPrice";
import { LEGACY_TIER_TO_PACKAGE } from "../lib/screeningMonetizationV2/screeningPackages";
import type { ScreeningPackageKey } from "../lib/screeningMonetizationV2/screeningPackageTypes";

export type ScreeningTier = "basic" | "verify" | "verify_ai";
export type ScreeningAddon =
  | "credit_score"
  | "expedited"
  | "income_verification"
  | "fraud_detection"
  | "enhanced_background";

const ADDON_AMOUNT_CENTS: Record<ScreeningAddon, number> = {
  credit_score: 499,
  expedited: 999,
  income_verification: 699,
  fraud_detection: 599,
  enhanced_background: 799,
};

export function resolveScreeningPackageKey(params: {
  screeningTier?: ScreeningTier;
  packageKey?: string | null;
}): ScreeningPackageKey {
  const rawPackageKey = String(params.packageKey || "").trim().toLowerCase();
  if (rawPackageKey === "standard" || rawPackageKey === "premium") return rawPackageKey;
  if (rawPackageKey === "basic") return "basic";
  return LEGACY_TIER_TO_PACKAGE[params.screeningTier || "basic"];
}

export function getScreeningPricing(params: {
  screeningTier: ScreeningTier;
  packageKey?: string | null;
  addons?: string[];
  currency?: string;
}) {
  const tier = params.screeningTier;
  const addons = new Set((params.addons || []).filter(Boolean));
  const packageKey = resolveScreeningPackageKey({
    screeningTier: tier,
    packageKey: params.packageKey,
  });
  const v2Addons = normalizeScreeningAddonsV2(params.addons || []);
  const creditScoreAddOnCents = addons.has("credit_score")
    ? ADDON_AMOUNT_CENTS.credit_score
    : 0;
  const expeditedAddOnCents = addons.has("expedited")
    ? ADDON_AMOUNT_CENTS.expedited
    : 0;
  const v2Pricing = calculateScreeningPrice({
    packageKey,
    addons: v2Addons,
    currency: params.currency || "CAD",
  });
  const baseAmountCents = v2Pricing.packageAmountCents;
  const totalAmountCents = v2Pricing.totalAmountCents + creditScoreAddOnCents + expeditedAddOnCents;
  const currency = v2Pricing.currency;

  return {
    packageKey,
    baseAmountCents,
    verifiedAddOnCents: 0,
    aiAddOnCents: 0,
    scoreAddOnCents: creditScoreAddOnCents,
    expeditedAddOnCents,
    addonAmountCents: v2Pricing.addonAmountCents,
    v2AddonAmountCents: v2Pricing.addonAmountCents,
    totalAmountCents,
    currency,
  };
}
