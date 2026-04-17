import {
  resolveCanonicalPlan,
  type Plan as CanonicalPlan,
} from "../services/entitlements/planCapabilities";

export type Plan = CanonicalPlan;
type PlanAlias = CanonicalPlan | "screening" | "core";

export type Capability =
  | "ai.insights"
  | "team.invites"
  | "properties.create"
  | "units.create"
  | "registry_filing_access"
  | "registry_attempts_history";

export interface PlanSpec {
  plan: PlanAlias;
  capabilities: Record<Capability, boolean>;
}

export const PLANS: Record<PlanAlias, PlanSpec> = {
  free: {
    plan: "free",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: false,
      registry_attempts_history: false,
    },
  },
  screening: {
    plan: "screening",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: false,
      registry_attempts_history: false,
    },
  },
  starter: {
    plan: "starter",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: false,
      registry_attempts_history: false,
    },
  },
  core: {
    plan: "core",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: false,
      registry_attempts_history: false,
    },
  },
  pro: {
    plan: "pro",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: true,
      registry_attempts_history: true,
    },
  },
  elite: {
    plan: "elite",
    capabilities: {
      "ai.insights": true,
      "team.invites": true,
      "properties.create": true,
      "units.create": true,
      registry_filing_access: true,
      registry_attempts_history: true,
    },
  },
};

export function resolvePlan(input?: string | null): Plan {
  const normalized = resolveCanonicalPlan(input);
  if (normalized) return normalized;
  return resolveCanonicalPlan(process.env.RENTCHAIN_DEFAULT_PLAN) || "free";
}
