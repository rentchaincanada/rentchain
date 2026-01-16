export type Plan = "starter" | "core" | "pro" | "elite";

export type Capability =
  | "ai.insights"
  | "team.invites"
  | "screening"
  | "properties.create"
  | "units.create";

export interface PlanLimits {
  maxProperties: number;
  maxUnits: number;
  screeningCreditsMonthly: number;
}

export interface PlanSpec {
  plan: Plan;
  limits: PlanLimits;
  capabilities: Record<Capability, boolean>;
}

export const PLANS: Record<Plan, PlanSpec> = {
  starter: {
    plan: "starter",
    limits: { maxProperties: 1, maxUnits: 10, screeningCreditsMonthly: 0 },
    capabilities: {
      "ai.insights": false,
      "team.invites": false,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  core: {
    plan: "core",
    limits: { maxProperties: 3, maxUnits: 50, screeningCreditsMonthly: 10 },
    capabilities: {
      "ai.insights": true,
      "team.invites": false,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  pro: {
    plan: "pro",
    limits: { maxProperties: 25, maxUnits: 500, screeningCreditsMonthly: 50 },
    capabilities: {
      "ai.insights": true,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  elite: {
    plan: "elite",
    limits: { maxProperties: 9999, maxUnits: 999999, screeningCreditsMonthly: 9999 },
    capabilities: {
      "ai.insights": true,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
};

export function resolvePlan(input?: string | null): Plan {
  const p = (input ?? "").toLowerCase().trim();
  if (p === "starter" || p === "core" || p === "pro" || p === "elite") return p;
  return (process.env.RENTCHAIN_DEFAULT_PLAN as Plan) || "starter";
}
