export type Plan = "free" | "starter" | "pro" | "elite";

const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "elite"];

const PLAN_ADDITIONS: Record<Plan, string[]> = {
  free: [
    "properties",
    "units",
    "tenants_manual",
    "applications_manual",
    "screening_pay_per_use",
    "unitsTable",
    "properties.create",
    "units.create",
  ],
  starter: [
    "tenant_invites",
    "applications",
    "messaging",
    "ledger_basic",
    "ledger",
    "leases",
    "maintenance",
    "notices",
    "tenantPortal",
  ],
  pro: [
    "ledger_verified",
    "exports_basic",
    "compliance_reports",
    "portfolio_dashboard",
    "team.invites",
    "exports",
  ],
  elite: [
    "ai_summaries",
    "exports_advanced",
    "audit_logs",
    "portfolio_analytics",
  ],
};

function normalizePlanInput(input?: string | null): string {
  return String(input || "").trim().toLowerCase();
}

export function resolveCanonicalPlan(input?: string | null): Plan {
  const plan = normalizePlanInput(input);
  if (plan === "free" || plan === "screening") return "free";
  if (plan === "starter" || plan === "core") return "starter";
  if (plan === "pro") return "pro";
  if (plan === "elite" || plan === "business" || plan === "enterprise") return "elite";
  return "free";
}

export function capabilitiesForPlan(planInput?: string | null): string[] {
  const plan = resolveCanonicalPlan(planInput);
  const maxIndex = PLAN_ORDER.indexOf(plan);
  const set = new Set<string>();

  for (let i = 0; i <= maxIndex; i += 1) {
    for (const capability of PLAN_ADDITIONS[PLAN_ORDER[i]]) {
      set.add(capability);
    }
  }

  return Array.from(set).sort();
}

export function allCanonicalCapabilities(): string[] {
  return capabilitiesForPlan("elite");
}
