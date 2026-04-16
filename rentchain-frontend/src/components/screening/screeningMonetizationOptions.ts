export type ScreeningPackageOption = {
  key: "basic" | "standard" | "premium";
  legacyTier: "basic" | "verify" | "verify_ai";
  label: string;
  description: string;
  priceCents: number;
  includes: string[];
};

export type ScreeningAddonOption = {
  key: "income_verification" | "fraud_detection" | "enhanced_background";
  label: string;
  description: string;
  priceCents: number;
};

export const SCREENING_PACKAGE_OPTIONS: ScreeningPackageOption[] = [
  {
    key: "basic",
    legacyTier: "basic",
    label: "Basic",
    description: "Credit and basic background screening.",
    priceCents: 1999,
    includes: ["Credit check", "Basic background"],
  },
  {
    key: "standard",
    legacyTier: "verify",
    label: "Standard",
    description: "Expanded screening with eviction and basic verification.",
    priceCents: 2999,
    includes: ["Credit check", "Background check", "Eviction history", "Basic verification"],
  },
  {
    key: "premium",
    legacyTier: "verify_ai",
    label: "Premium",
    description: "Full screening with advanced verification and fraud signals.",
    priceCents: 3999,
    includes: ["Full screening", "Advanced verification", "Fraud signals"],
  },
];

export const SCREENING_ADDON_OPTIONS: ScreeningAddonOption[] = [
  {
    key: "income_verification",
    label: "Income verification",
    description: "Add income verification for applicants.",
    priceCents: 699,
  },
  {
    key: "fraud_detection",
    label: "Fraud detection",
    description: "Add extra fraud signal checks.",
    priceCents: 599,
  },
  {
    key: "enhanced_background",
    label: "Enhanced background",
    description: "Add deeper background coverage.",
    priceCents: 799,
  },
];

export function formatPriceCents(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

export function getScreeningPackageOption(packageKey: ScreeningPackageOption["key"]) {
  return (
    SCREENING_PACKAGE_OPTIONS.find((option) => option.key === packageKey) || SCREENING_PACKAGE_OPTIONS[0]
  );
}

export function calculateScreeningDisplayPrice(params: {
  packageKey: ScreeningPackageOption["key"];
  addons: ScreeningAddonOption["key"][];
}) {
  const pkg = getScreeningPackageOption(params.packageKey);
  const addOnTotal = SCREENING_ADDON_OPTIONS.filter((option) => params.addons.includes(option.key)).reduce(
    (sum, option) => sum + option.priceCents,
    0
  );
  return pkg.priceCents + addOnTotal;
}
