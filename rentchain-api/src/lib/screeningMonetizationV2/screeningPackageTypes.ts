export type ScreeningPackageKey = "basic" | "standard" | "premium";

export type ScreeningAddonKey =
  | "income_verification"
  | "fraud_detection"
  | "enhanced_background";

export type ScreeningPackageV2 = {
  key: ScreeningPackageKey;
  label: string;
  description: string;
  basePrice: number;
  includes: string[];
};

export type ScreeningAddonV2 = {
  key: ScreeningAddonKey;
  label: string;
  description: string;
  price: number;
};
