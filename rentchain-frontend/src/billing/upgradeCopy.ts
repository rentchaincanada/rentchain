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
  title: "Unlock the next set of workflow tools",
  subtitle:
    "Keep moving in your current workflow, then upgrade when you want more visibility, cleaner follow-through, and stronger reporting.",
  bullets: [
    "Add the tools behind this workflow",
    "Keep records clearer as work gets busier",
    "Move to paid plans without changing your setup",
  ],
  primaryCta: "Unlock more workflow tools",
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
    title: "Upgrade to keep tenant communication in one place",
    subtitle: "Starter adds messaging tools so notices, follow-ups, and tenant communication stay tied to the rental workflow.",
    bullets: ["Message tenants in one place", "Keep a full conversation history", "Reduce missed updates"],
    primaryCta: "Unlock messaging",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  ledger: {
    title: "Upgrade to access the ledger",
    subtitle: "Starter includes the core ledger workspace, while Pro adds stronger exports and verified reporting.",
    bullets: ["Audit-ready history", "Exportable records", "Fast verification"],
    primaryCta: "Upgrade to Starter",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
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
    title: "Upgrade to run maintenance in one workflow",
    subtitle: "Starter adds maintenance and work order tools so requests, updates, and follow-through stay organized.",
    bullets: ["Track requests in one place", "Assign and resolve faster", "Keep a clean history"],
    primaryCta: "Unlock maintenance workflows",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  applications: {
    title: "Upgrade to keep applications connected",
    subtitle: "Starter adds linked invites, application workflow tools, and clearer applicant tracking in one place.",
    bullets: ["Send secure application links", "Track applicants in one place", "Keep applications tied to the property"],
    primaryCta: "Unlock applicant workflows",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
  },
  tenant_invites: {
    title: "Upgrade to invite tenants without breaking the workflow",
    subtitle:
      "Starter adds tenant invites, linked applications, and messaging so you can move from outreach to application review in one place.",
    bullets: [
      "Send tenant invites from the rental workflow",
      "Keep invites, applications, and follow-up connected",
      "Reduce manual handoffs between applicant steps",
    ],
    primaryCta: "Unlock tenant invites",
    secondaryCta: "Not now",
    requiredPlanLabel: "Starter",
    trustNote: "Secure checkout. You can review pricing before confirming.",
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
  screening_workflow: {
    title: "Upgrade to keep screening inside the applicant workflow",
    subtitle: "Starter includes applicant screening workflow tools inside RentChain.",
    bullets: [
      "Send screening requests from the application workflow",
      "Keep screening activity tied to the applicant record",
      "Review screening progress without leaving RentChain",
    ],
    primaryCta: "Unlock screening workflow tools",
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
  portfolio_score: {
    title: "Upgrade to unlock Portfolio Score™",
    subtitle: "Pro adds a structured portfolio score so you can see how consistently your rental operations are performing.",
    bullets: [
      "Track score, grade, and recent direction",
      "Review portfolio components in one view",
      "Use a clearer operational benchmark as your portfolio grows",
    ],
    primaryCta: "Upgrade to Pro",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
  portfolio_action_recommendations: {
    title: "Upgrade to unlock recommended actions",
    subtitle: "Elite adds landlord-safe recommended actions based on your portfolio health, score, and recent direction.",
    bullets: [
      "See prioritized next steps each day",
      "Turn portfolio signals into clearer follow-through",
      "Keep advanced intelligence tied to your portfolio trends",
    ],
    primaryCta: "Unlock recommended actions",
    secondaryCta: "Not now",
    requiredPlanLabel: "Elite",
  },
  marketplace_directory: {
    title: "Upgrade to unlock the contractor directory",
    subtitle: "Pro adds a private contractor network so you can manage marketplace-ready service profiles inside RentChain.",
    bullets: [
      "Build and maintain a private contractor directory",
      "Filter service providers by category, area, and availability",
      "Keep contractor invites and profile management in one place",
    ],
    primaryCta: "Unlock contractor directory",
    secondaryCta: "Not now",
    requiredPlanLabel: "Pro",
  },
  marketplace_contractor_assignment: {
    title: "Upgrade to unlock contractor assignment",
    subtitle: "Elite adds embedded marketplace assignment inside work orders so you can match maintenance demand to your contractor network faster.",
    bullets: [
      "Discover contractor candidates directly from a work order",
      "Assign the right contractor without leaving the maintenance workflow",
      "Keep contractor assignment tied to the job record",
    ],
    primaryCta: "Unlock contractor assignment",
    secondaryCta: "Not now",
    requiredPlanLabel: "Elite",
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
  if (key === "screening_workflow") return COPY_MAP.screening_workflow;
  if (key === "tenantportal") return COPY_MAP.screening;
  if (key === "move_in_readiness" || key === "work_orders") return COPY_MAP.maintenance;
  if (key === "pdf_export") return COPY_MAP.exports;
  if (key === "review_summary") return COPY_MAP.tenant_screening;
  if (key === "properties.create") return COPY_MAP.properties;
  if (key === "units.create") return COPY_MAP.units;
  if (key === "portfolio_score") return COPY_MAP.portfolio_score;
  if (key === "portfolio_action_recommendations") return COPY_MAP.portfolio_action_recommendations;
  if (key === "marketplace_directory") return COPY_MAP.marketplace_directory;
  if (key === "marketplace_contractor_assignment") return COPY_MAP.marketplace_contractor_assignment;
  if (key === "portfolio.ai" || key === "ai.summary") return COPY_MAP["ai.insights"];
  if (key.includes("screening")) return COPY_MAP.tenant_screening;
  if (key.includes("application") || key.includes("apply")) return COPY_MAP.applications;
  if (key.includes("property")) return COPY_MAP.properties;
  if (key.includes("unit")) return COPY_MAP.units;

  return DEFAULT_COPY;
}
