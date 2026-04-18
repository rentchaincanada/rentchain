export type PricingPlanKey = "free" | "starter" | "pro" | "elite";
export type PricingInterval = "monthly" | "yearly";

export type TierCapabilityStatus =
  | "included"
  | "limited"
  | "pay_per_use"
  | "upgrade_required"
  | "coming_soon";

export type TierCapabilityArea =
  | "properties_units"
  | "applications"
  | "screening"
  | "messaging"
  | "work_orders"
  | "expenses"
  | "exports"
  | "reports"
  | "compliance_tools"
  | "lease_tools"
  | "automation"
  | "team_admin_tools";

export type PricingPlan = {
  key: PricingPlanKey;
  label: string;
  monthlyPrice: string;
  yearlyPrice: string;
  tagline: string;
  features: string[];
};

export type TierCapabilityEntry = {
  status: TierCapabilityStatus;
  summary: string;
};

export type TierMatrixPlan = PricingPlan & {
  ctaLabel: string;
  capabilities: Record<TierCapabilityArea, TierCapabilityEntry>;
};

export type TierPositioning = {
  badge: string;
  audience: string;
  support: string;
  nextStepReason?: string;
};

export const TIER_MATRIX_AREAS: Array<{ key: TierCapabilityArea; label: string }> = [
  { key: "properties_units", label: "Properties / units" },
  { key: "applications", label: "Applications" },
  { key: "screening", label: "Screening" },
  { key: "messaging", label: "Messaging" },
  { key: "work_orders", label: "Work orders" },
  { key: "expenses", label: "Expenses" },
  { key: "exports", label: "Exports" },
  { key: "reports", label: "Reports" },
  { key: "compliance_tools", label: "Compliance tools" },
  { key: "lease_tools", label: "Lease tools" },
  { key: "automation", label: "Automation" },
  { key: "team_admin_tools", label: "Team / admin tools" },
];

export const TIER_POSITIONING_COPY: Record<Exclude<PricingPlanKey, "free">, TierPositioning> = {
  starter: {
    badge: "Workflow foundation",
    audience: "For landlords who need one place to run the weekly rental workflow across active rentals.",
    support:
      "Starter is the first paid plan built to keep applicant, tenant, and property work together in one operating flow.",
    nextStepReason:
      "Starter is the clearest move into the workflow foundation for active rental operations.",
  },
  pro: {
    badge: "Operations and reporting",
    audience:
      "For operators who need stronger operational control, cleaner reporting, and better handoff between people and tasks.",
    support:
      "Pro is the step up when operational complexity starts growing and you need exports, reporting, and stronger coordination.",
    nextStepReason:
      "Pro is the next logical step when you need stronger operational control, cleaner reporting, and better coordination as work gets busier.",
  },
  elite: {
    badge: "Insights and oversight",
    audience:
      "For portfolios that need insight-led oversight, portfolio trends, and higher-confidence decisions.",
    support:
      "Elite is for teams that want portfolio-level visibility, intelligence, and higher-confidence oversight on top of Pro.",
    nextStepReason:
      "Elite is the next logical step when you need portfolio intelligence, analytics, and oversight that sit above the operational tools already in Pro.",
  },
};

// Canonical pricing and capability matrix used by /pricing and /billing.
// It mirrors the current commercial truth from backend billing prices plus
// entitlement gating from planCapabilities/capabilities:
// Free: guided setup + pay-per-use screening
// Starter: operating workflows
// Pro: exports, reports, compliance, team tools
// Elite: advanced analytics / audit visibility
export const CANONICAL_TIER_MATRIX: Record<PricingPlanKey, TierMatrixPlan> = {
  free: {
    key: "free",
    label: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    tagline: "Best for guided setup, manual workflows, and pay-per-use screening.",
    ctaLabel: "Start Free",
    features: [
      "Properties and units with archive support",
      "Manual applicant workflow and basic viewings",
      "Pay-per-use screening request path",
      "Manual expense tracking and history",
      "No subscription required to get started",
    ],
    capabilities: {
      properties_units: { status: "included", summary: "Create properties and units with archive/history support." },
      applications: { status: "limited", summary: "Manual applicant workflow only." },
      screening: { status: "pay_per_use", summary: "Guided screening flow and history; screening charges apply when used." },
      messaging: { status: "upgrade_required", summary: "Messaging starts on Starter." },
      work_orders: { status: "upgrade_required", summary: "Work orders start on Starter." },
      expenses: { status: "limited", summary: "Manual expense tracking." },
      exports: { status: "upgrade_required", summary: "Accountant-ready exports start on Pro." },
      reports: { status: "limited", summary: "Basic workflow visibility only." },
      compliance_tools: { status: "upgrade_required", summary: "Compliance reporting starts on Pro." },
      lease_tools: { status: "upgrade_required", summary: "Lease workflows start on Starter." },
      automation: { status: "coming_soon", summary: "Advanced automation is not generally available yet." },
      team_admin_tools: { status: "upgrade_required", summary: "Team tools start on Pro." },
    },
  },
  starter: {
    key: "starter",
    label: "Starter",
    monthlyPrice: "$29",
    yearlyPrice: "$290",
    tagline: "Best for workflow foundation across day-to-day rental operations.",
    ctaLabel: "Upgrade to Starter",
    features: [
      "Tenant invites and linked applications",
      "Messaging, notices, and tenant portal workflows",
      "Leases, maintenance, move-in readiness, and work orders",
      "Basic ledger workspace for day-to-day operations",
      "Keeps pay-per-use screening available with stronger workflow support",
    ],
    capabilities: {
      properties_units: { status: "included", summary: "Portfolio setup plus tenant-operating workflows." },
      applications: { status: "included", summary: "Linked applications and invites." },
      screening: { status: "pay_per_use", summary: "Screening remains pay-per-use, with richer request/status workflow." },
      messaging: { status: "included", summary: "Messaging and notices are included." },
      work_orders: { status: "included", summary: "Maintenance and work orders are included." },
      expenses: { status: "limited", summary: "Manual expense tracking remains available." },
      exports: { status: "upgrade_required", summary: "Export workflows start on Pro." },
      reports: { status: "limited", summary: "Operational workflow reporting, but not advanced exports/compliance." },
      compliance_tools: { status: "upgrade_required", summary: "Compliance reporting starts on Pro." },
      lease_tools: { status: "included", summary: "Lease workflows are included." },
      automation: { status: "coming_soon", summary: "Advanced automation is not generally available yet." },
      team_admin_tools: { status: "upgrade_required", summary: "Team invites and advanced admin controls start on Pro." },
    },
  },
  pro: {
    key: "pro",
    label: "Pro",
    monthlyPrice: "$49",
    yearlyPrice: "$490",
    tagline: "Best for operational control, exports, and reporting as complexity grows.",
    ctaLabel: "Upgrade to Pro",
    features: [
      "CSV, spreadsheet, and PDF export paths",
      "Screening decision summaries and landlord-ready PDFs",
      "Compliance reports and stronger portfolio reporting",
      "Team invites and portfolio dashboard tools",
      "Keeps Starter workflows and pay-per-use screening",
    ],
    capabilities: {
      properties_units: { status: "included", summary: "Full portfolio workflows." },
      applications: { status: "included", summary: "Applications and invites included." },
      screening: { status: "pay_per_use", summary: "Screening stays pay-per-use; Pro adds summaries, review support, and reporting." },
      messaging: { status: "included", summary: "Messaging is included." },
      work_orders: { status: "included", summary: "Work orders are included." },
      expenses: { status: "included", summary: "CSV expense import plus stronger reporting workflows." },
      exports: { status: "included", summary: "CSV, spreadsheet, and PDF exports." },
      reports: { status: "included", summary: "Decision support, dashboard, and stronger reporting." },
      compliance_tools: { status: "included", summary: "Compliance reports are included." },
      lease_tools: { status: "included", summary: "Lease workflows are included." },
      automation: { status: "coming_soon", summary: "Advanced automation remains a staged rollout." },
      team_admin_tools: { status: "limited", summary: "Team invites and shared workflow tools included; advanced audit/admin controls start on Elite." },
    },
  },
  elite: {
    key: "elite",
    label: "Elite",
    monthlyPrice: "$79",
    yearlyPrice: "$790",
    tagline: "Best for portfolio intelligence, analytics, and advanced oversight.",
    ctaLabel: "Upgrade to Elite",
    features: [
      "Advanced exports and audit visibility",
      "Portfolio analytics and AI summaries",
      "Premium reporting for complex operations",
      "Keeps Pro exports, compliance, and team workflows",
      "Top-tier operating visibility without changing screening pricing",
    ],
    capabilities: {
      properties_units: { status: "included", summary: "All portfolio workflows included." },
      applications: { status: "included", summary: "Applications and invites included." },
      screening: { status: "pay_per_use", summary: "Screening stays pay-per-use; Elite adds the deepest reporting context." },
      messaging: { status: "included", summary: "Messaging is included." },
      work_orders: { status: "included", summary: "Work orders are included." },
      expenses: { status: "included", summary: "Advanced export/reporting workflows." },
      exports: { status: "included", summary: "Advanced exports and audit visibility." },
      reports: { status: "included", summary: "Advanced analytics and premium reporting." },
      compliance_tools: { status: "included", summary: "Compliance and audit visibility." },
      lease_tools: { status: "included", summary: "Lease workflows are included." },
      automation: { status: "coming_soon", summary: "Advanced automation remains staged; Elite gets the best visibility layer today." },
      team_admin_tools: { status: "included", summary: "Top-tier team, audit, and admin-oriented visibility." },
    },
  },
};

export const PLAN_ORDER: PricingPlanKey[] = ["free", "starter", "pro", "elite"];

export const DEFAULT_PLANS: PricingPlan[] = PLAN_ORDER.map((key) => {
  const plan = CANONICAL_TIER_MATRIX[key];
  return {
    key: plan.key,
    label: plan.label,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    tagline: plan.tagline,
    features: plan.features,
  };
});

export function getPricingPlan(planKey: PricingPlanKey): TierMatrixPlan {
  return CANONICAL_TIER_MATRIX[planKey];
}
