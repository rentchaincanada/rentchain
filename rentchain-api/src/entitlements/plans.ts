export type Plan = "free" | "starter" | "pro" | "business" | "screening" | "core" | "elite";

export type Capability =
  | "ai.insights"
  | "team.invites"
  | "screening"
  | "properties.create"
  | "units.create";

export interface PlanSpec {
  plan: Plan;
  capabilities: Record<Capability, boolean>;
}

export const PLANS: Record<Plan, PlanSpec> = {
  free: {
    plan: "free",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  screening: {
    plan: "screening",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  starter: {
    plan: "starter",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  core: {
    plan: "core",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  pro: {
    plan: "pro",
    capabilities: {
      "ai.insights": false,
      "team.invites": true,
      "screening": true,
      "properties.create": true,
      "units.create": true,
    },
  },
  business: {
    plan: "business",
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
  if (p === "starter" || p === "core") return "starter";
  if (p === "pro") return "pro";
  if (p === "business" || p === "elite" || p === "enterprise") return "business";
  if (p === "free" || p === "screening") return "free";
  return (process.env.RENTCHAIN_DEFAULT_PLAN as Plan) || "free";
}
