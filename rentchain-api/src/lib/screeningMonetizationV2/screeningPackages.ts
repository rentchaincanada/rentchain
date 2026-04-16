import type {
  ScreeningAddonKey,
  ScreeningAddonV2,
  ScreeningPackageKey,
  ScreeningPackageV2,
} from "./screeningPackageTypes";

export const SCREENING_PACKAGES_V2: Record<ScreeningPackageKey, ScreeningPackageV2> = {
  basic: {
    key: "basic",
    label: "Basic",
    description: "Essential credit and background screening.",
    basePrice: 1999,
    includes: ["Credit check", "Basic background check"],
  },
  standard: {
    key: "standard",
    label: "Standard",
    description: "Expanded screening with eviction and basic verification.",
    basePrice: 2999,
    includes: ["Credit check", "Background check", "Eviction history", "Basic verification"],
  },
  premium: {
    key: "premium",
    label: "Premium",
    description: "Full screening with advanced verification and fraud signals.",
    basePrice: 3999,
    includes: ["Full screening", "Advanced verification", "Fraud signals"],
  },
};

export const SCREENING_ADDONS_V2: Record<ScreeningAddonKey, ScreeningAddonV2> = {
  income_verification: {
    key: "income_verification",
    label: "Income verification",
    description: "Adds income verification to the screening package.",
    price: 699,
  },
  fraud_detection: {
    key: "fraud_detection",
    label: "Fraud detection",
    description: "Adds extra fraud detection signals.",
    price: 599,
  },
  enhanced_background: {
    key: "enhanced_background",
    label: "Enhanced background",
    description: "Adds deeper background verification coverage.",
    price: 799,
  },
};

export const LEGACY_TIER_TO_PACKAGE: Record<"basic" | "verify" | "verify_ai", ScreeningPackageKey> = {
  basic: "basic",
  verify: "standard",
  verify_ai: "premium",
};

export const PACKAGE_TO_LEGACY_TIER: Record<ScreeningPackageKey, "basic" | "verify" | "verify_ai"> = {
  basic: "basic",
  standard: "verify",
  premium: "verify_ai",
};

export const SCREENING_PACKAGE_ORDER: ScreeningPackageKey[] = ["basic", "standard", "premium"];
export const SCREENING_ADDON_ORDER: ScreeningAddonKey[] = [
  "income_verification",
  "fraud_detection",
  "enhanced_background",
];
