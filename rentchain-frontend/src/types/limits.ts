export type CapabilityKey =
  | "ai.insights"
  | "team.invites"
  | "screening"
  | "properties.create"
  | "units.create";

export type AccountLimitsResponse = {
  status: "ok";
  plan: string;
  limits: { maxProperties: number; maxUnits: number; screeningCreditsMonthly: number };
  capabilities: Record<CapabilityKey, boolean> & Record<string, boolean>;
  // optional future fields:
  usage?: { properties?: number; units?: number; screeningsThisMonth?: number };
  integrity?: any;
};
