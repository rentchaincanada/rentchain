export type Plan = "screening" | "starter" | "core" | "pro" | "elite";

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
  screening: {
    plan: "screening",
    limits: { maxProperties: Number.MAX_SAFE_INTEGER, maxUnits: Number.MAX_SAFE_INTEGER, screeningCreditsMonthly: 0 },
    capabilities: {
      "ai.insights": false,
      "team.invites": false,
      "screening": true,
      "properties.create": true,
      "units.create": false,
    },
  },
  starter: {
    plan: "starter",
    limits: { maxProperties: Number.MAX_SAFE_INTEGER, maxUnits: Number.MAX_SAFE_INTEGER, screeningCreditsMonthly: 0 },
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
    limits: { maxProperties: Number.MAX_SAFE_INTEGER, maxUnits: Number.MAX_SAFE_INTEGER, screeningCreditsMonthly: 0 },
    capabilities: {
      "ai.insights": false,
      "team.invites": false,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  pro: {
    plan: "pro",
    limits: { maxProperties: Number.MAX_SAFE_INTEGER, maxUnits: Number.MAX_SAFE_INTEGER, screeningCreditsMonthly: 0 },
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
    limits: { maxProperties: Number.MAX_SAFE_INTEGER, maxUnits: Number.MAX_SAFE_INTEGER, screeningCreditsMonthly: 0 },
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
  if (p === "starter" || p === "core" || p === "pro" || p === "elite" || p === "screening") return p;
  return (process.env.RENTCHAIN_DEFAULT_PLAN as Plan) || "screening";
}
