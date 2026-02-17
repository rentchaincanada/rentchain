export type UpgradeCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  requiredPlanLabel?: string;
  trustNote?: string;
};

const DEFAULT_COPY: UpgradeCopy = {
  title: "Upgrade to unlock this feature",
  subtitle: "Your current plan doesn't include this capability.",
  bullets: ["Unlock premium workflows", "Save time with automation", "Get priority support"],
  primaryCta: "Upgrade now",
  secondaryCta: "Not now",
  trustNote: "Secure checkout. Cancel anytime.",
};

const COPY_MAP: Record<string, UpgradeCopy> = {
  tenant_screening: {
    title: "Upgrade to run tenant screening",
    subtitle: "Credit & identity checks are available on Pro.",
    bullets: [
      "Run checks in minutes",
      "Save results to the tenant profile",
      "Built-in consent & audit trail",
    ],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
    trustNote: "Secure checkout. No setup fees.",
  },
  extra_properties: {
    title: "Upgrade to add more properties",
    subtitle: "Your current plan doesn't include this workflow.",
    bullets: [
      "Manage more units in one dashboard",
      "Invite tenants and track events",
      "Export reports anytime",
    ],
    primaryCta: "Upgrade now",
    secondaryCta: "Not now",
    trustNote: "Upgrade takes less than a minute.",
  },
  properties: {
    title: "Upgrade to add more properties",
    subtitle: "Your current plan doesn't include this workflow.",
    bullets: [
      "Manage more units in one dashboard",
      "Invite tenants and track events",
      "Export reports anytime",
    ],
    primaryCta: "Upgrade now",
    secondaryCta: "Not now",
  },
  units: {
    title: "Upgrade to add more units",
    subtitle: "Your current plan doesn't include this workflow.",
    bullets: ["Keep everything in one place", "Track occupancy and rent", "Export reports anytime"],
    primaryCta: "Upgrade now",
    secondaryCta: "Not now",
  },
  messaging: {
    title: "Upgrade to use messaging",
    subtitle: "Tenant messaging is available on Pro.",
    bullets: ["Message tenants in one place", "Keep a full conversation history", "Reduce missed updates"],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
  ledger: {
    title: "Upgrade to access the ledger",
    subtitle: "Ledger tools are available on Pro.",
    bullets: ["Audit-ready history", "Exportable records", "Fast verification"],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
  exports: {
    title: "Upgrade to unlock exports",
    subtitle: "Advanced exports are available on Pro.",
    bullets: ["Download anytime", "Share with stakeholders", "Keep a clean audit trail"],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
  maintenance: {
    title: "Upgrade to manage maintenance",
    subtitle: "Maintenance workflows start on Starter.",
    bullets: ["Track requests in one place", "Assign and resolve faster", "Keep a clean history"],
    primaryCta: "Upgrade to Starter",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  applications: {
    title: "Upgrade to send applications",
    subtitle: "Application links are available on Starter.",
    bullets: ["Send secure application links", "Track applicants in one place", "Keep applications tied to the property"],
    primaryCta: "Upgrade to Starter",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  leases: {
    title: "Upgrade to manage leases",
    subtitle: "Lease management starts on Starter.",
    bullets: ["Create and track leases", "Stay on top of renewals", "Keep tenant records tidy"],
    primaryCta: "Upgrade to Starter",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  screening: {
    title: "Upgrade to manage your rentals",
    subtitle: "Rental management starts on Starter.",
    bullets: ["Add properties and units", "Invite tenants and track events", "Export reports anytime"],
    primaryCta: "Upgrade to Starter",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  "ai.insights": {
    title: "Upgrade for AI insights",
    subtitle: "Portfolio insights are available on Pro.",
    bullets: ["Spot risks earlier", "Track key portfolio trends", "Get suggested actions"],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
};

function normalizeKey(featureKey: string) {
  return String(featureKey || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function getUpgradeCopy(featureKey?: string): UpgradeCopy {
  const key = normalizeKey(featureKey || "");
  if (!key) return DEFAULT_COPY;

  if (COPY_MAP[key]) return COPY_MAP[key];

  if (key === "unitstable") return COPY_MAP.units;
  if (key === "tenantportal") return COPY_MAP.screening;
  if (key === "properties.create") return COPY_MAP.properties;
  if (key === "units.create") return COPY_MAP.units;
  if (key === "portfolio.ai" || key === "ai.summary") return COPY_MAP["ai.insights"];
  if (key.includes("screening")) return COPY_MAP.tenant_screening;
  if (key.includes("application") || key.includes("apply")) return COPY_MAP.applications;
  if (key.includes("property")) return COPY_MAP.properties;
  if (key.includes("unit")) return COPY_MAP.units;

  return DEFAULT_COPY;
}
