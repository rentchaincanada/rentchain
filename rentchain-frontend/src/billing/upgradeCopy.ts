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
  title: "Upgrade when you’re ready for more workflow tools",
  subtitle: "You can keep using the core workflow now, then upgrade for richer operations and reporting.",
  bullets: ["Add more operational tools", "Improve reporting and exports", "Keep growing without switching systems"],
  primaryCta: "See upgrade options",
  secondaryCta: "Not now",
  trustNote: "Secure checkout. Cancel anytime.",
};

const COPY_MAP: Record<string, UpgradeCopy> = {
  tenant_screening: {
    title: "Upgrade to unlock fuller screening workflows",
    subtitle: "Guided screening requests, decision support, and stronger reporting are available on Pro.",
    bullets: [
      "Guide landlords from request to review",
      "Keep screening status and results in one place",
      "Use consent-aware workflows and clear records",
    ],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
    trustNote: "Secure checkout. No setup fees.",
  },
  extra_properties: {
    title: "Upgrade to add more properties",
    subtitle: "Keep setup moving now, then upgrade when you need to manage more doors in one workspace.",
    bullets: [
      "Manage more units in one dashboard",
      "Invite tenants and track events",
      "Keep portfolio history organized",
    ],
    primaryCta: "See upgrade options",
    secondaryCta: "Not now",
    trustNote: "Upgrade takes less than a minute.",
  },
  properties: {
    title: "Upgrade to add more properties",
    subtitle: "Keep setup moving now, then upgrade when you need to manage more doors in one workspace.",
    bullets: [
      "Manage more units in one dashboard",
      "Invite tenants and track events",
      "Keep portfolio history organized",
    ],
    primaryCta: "See upgrade options",
    secondaryCta: "Not now",
  },
  units: {
    title: "Upgrade to manage more units in one place",
    subtitle: "Start with your current setup, then upgrade when your portfolio needs more unit capacity and workflow tools.",
    bullets: ["Keep occupancy and rent organized", "Track more rentable spaces in one workspace", "Expand reporting as your portfolio grows"],
    primaryCta: "See upgrade options",
    secondaryCta: "Not now",
  },
  messaging: {
    title: "Upgrade to use messaging",
    subtitle: "Messaging tools are available on Pro for landlords who want cleaner communication records.",
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
    title: "Upgrade to unlock accountant-ready exports",
    subtitle: "Manual expense tracking stays available now. Pro adds bulk import plus export formats your accountant can use immediately.",
    bullets: ["Import expenses from CSV", "Export CSV, spreadsheet, and PDF reports", "Keep cleaner reporting for month-end and tax time"],
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
    title: "Upgrade to unlock richer applicant workflows",
    subtitle: "Keep setup moving now, then upgrade for linked invites, application workflows, and stronger tracking.",
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
    title: "Upgrade for richer rental operations",
    subtitle: "Free keeps guided setup usable today. Paid plans add more workflow, communication, and reporting depth.",
    bullets: ["Keep onboarding simple on Free", "Add richer applicant and landlord workflow tools", "Unlock stronger records and exports as you grow"],
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
  if (key === "move_in_readiness" || key === "work_orders") return COPY_MAP.maintenance;
  if (key === "pdf_export") return COPY_MAP.exports;
  if (key === "review_summary") return COPY_MAP.tenant_screening;
  if (key === "properties.create") return COPY_MAP.properties;
  if (key === "units.create") return COPY_MAP.units;
  if (key === "portfolio.ai" || key === "ai.summary") return COPY_MAP["ai.insights"];
  if (key.includes("screening")) return COPY_MAP.tenant_screening;
  if (key.includes("application") || key.includes("apply")) return COPY_MAP.applications;
  if (key.includes("property")) return COPY_MAP.properties;
  if (key.includes("unit")) return COPY_MAP.units;

  return DEFAULT_COPY;
}
