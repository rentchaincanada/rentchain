export const TIER_GUIDANCE_LINKS = {
  upgradeDocsUrl: "/pricing",
} as const;

export const UPGRADE_DRIVERS = [
  "Analytics",
  "Payments",
  "Work Orders",
  "Expenses",
  "Screening",
] as const;

export type UpgradeDriver = (typeof UPGRADE_DRIVERS)[number];

export const UPGRADE_DRIVER_DESCRIPTIONS: Record<UpgradeDriver, string> = {
  Analytics: "View clearer portfolio and operating insights.",
  Payments: "Track rent, obligations, and payment readiness in one place.",
  "Work Orders": "Coordinate maintenance follow-up and service work.",
  Expenses: "Import, review, and export accountant-ready expense records.",
  Screening: "Keep applicant screening workflow steps tied to the application.",
};

export const FEATURE_UPGRADE_DRIVERS: Record<string, UpgradeDriver[]> = {
  leases: ["Screening", "Payments"],
  ledger: ["Payments", "Analytics"],
  ledger_basic: ["Payments", "Analytics"],
  ledger_verified: ["Payments", "Analytics"],
  messaging: ["Work Orders"],
  operations_signals: ["Analytics", "Payments", "Work Orders", "Screening"],
  maintenance: ["Work Orders"],
  work_orders: ["Work Orders"],
  "expenses.import": ["Expenses", "Analytics"],
  "expenses.export": ["Expenses", "Analytics"],
  exports: ["Expenses", "Analytics"],
  exports_basic: ["Expenses", "Analytics"],
  pdf_export: ["Expenses", "Analytics"],
  screening: ["Screening"],
  screening_workflow: ["Screening"],
};

export function getUpgradeDriversForFeature(featureKey?: string | null): UpgradeDriver[] {
  const normalized = String(featureKey || "").trim().toLowerCase();
  if (normalized && FEATURE_UPGRADE_DRIVERS[normalized]) return FEATURE_UPGRADE_DRIVERS[normalized];
  if (normalized.includes("expense") || normalized.includes("export")) return ["Expenses", "Analytics"];
  if (normalized.includes("ledger") || normalized.includes("payment")) return ["Payments", "Analytics"];
  if (normalized.includes("message")) return ["Work Orders"];
  if (normalized.includes("screening")) return ["Screening"];
  if (normalized.includes("work_order") || normalized.includes("maintenance")) return ["Work Orders"];
  return ["Analytics"];
}

export const FREE_TIER_UPGRADE_GUIDANCE = {
  freeLabel: "Free tier",
  starterLabel: "Starter",
  propertyCreate: {
    title: "Free tier keeps setup manual",
    body:
      "Free tier includes manual applicant intake and basic property management. Upgrade to Starter to send batch application invitations and enable tenant portals.",
    ctaLabel: "Learn more",
  },
  applications: {
    title: "Manual applicant intake stays available on Free",
    body:
      "Starter adds batch application invitations, screening workflow tools, and tenant portals when you are ready to move beyond manual intake.",
    ctaLabel: "Learn about Starter",
  },
  propertyOverview: {
    title: "Free tier property workflow",
    body:
      "Free tier supports manual applicant intake and basic property management. Starter adds batch application invitations, screening workflow tools, and tenant portals.",
    ctaLabel: "Upgrade to Starter",
  },
} as const;
