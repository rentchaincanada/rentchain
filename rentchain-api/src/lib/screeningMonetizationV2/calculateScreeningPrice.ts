import { SCREENING_ADDONS_V2, SCREENING_PACKAGES_V2 } from "./screeningPackages";
import type { ScreeningAddonKey, ScreeningPackageKey } from "./screeningPackageTypes";

export function isScreeningPackageKey(value: unknown): value is ScreeningPackageKey {
  return value === "basic" || value === "standard" || value === "premium";
}

export function isScreeningAddonKey(value: unknown): value is ScreeningAddonKey {
  return (
    value === "income_verification" || value === "fraud_detection" || value === "enhanced_background"
  );
}

export function normalizeScreeningAddonsV2(raw: unknown): ScreeningAddonKey[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const seen = new Set<ScreeningAddonKey>();
  const normalized: ScreeningAddonKey[] = [];
  for (const value of values) {
    const next = String(value || "").trim().toLowerCase();
    if (!isScreeningAddonKey(next) || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

export function calculateScreeningPrice(params: {
  packageKey: ScreeningPackageKey;
  addons?: ScreeningAddonKey[];
  currency?: string;
}) {
  const selectedPackage = SCREENING_PACKAGES_V2[params.packageKey];
  const selectedAddons = normalizeScreeningAddonsV2(params.addons || []);
  const addOnAmountCents = selectedAddons.reduce((total, key) => total + SCREENING_ADDONS_V2[key].price, 0);
  return {
    packageKey: selectedPackage.key,
    packageAmountCents: selectedPackage.basePrice,
    addonAmountCents: addOnAmountCents,
    totalAmountCents: selectedPackage.basePrice + addOnAmountCents,
    currency: String(params.currency || "CAD").toUpperCase(),
  };
}
