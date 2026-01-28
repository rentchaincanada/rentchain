export type CapabilityKey =
  | "screening"
  | "unitsTable"
  | "leases"
  | "ledger"
  | "maintenance"
  | "notices"
  | "messaging"
  | "tenantPortal"
  | "exports";

export type AccountLimitsResponse = {
  status: "ok";
  plan: string;
  limits: { maxProperties: number; maxUnits: number; screeningCreditsMonthly: number };
  capabilities: Record<CapabilityKey, boolean> & Record<string, boolean>;
  // optional future fields:
  usage?: { properties?: number; units?: number; screeningsThisMonth?: number };
  integrity?: any;
};
