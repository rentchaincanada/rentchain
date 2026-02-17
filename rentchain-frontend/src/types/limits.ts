export type CapabilityKey =
  | "applications"
  | "tenant_invites"
  | "properties_unlimited"
  | "units_unlimited"
  | "screening"
  | "ledger_basic"
  | "ledger_verified"
  | "exports_basic"
  | "exports_advanced"
  | "compliance_reports"
  | "audit_logs"
  | "ai_summaries"
  | "portfolio_analytics"
  | "unitsTable"
  | "leases"
  | "ledger"
  | "maintenance"
  | "notices"
  | "messaging"
  | "tenantPortal"
  | "exports"
  | "team.invites";

export type AccountLimitsResponse = {
  status: "ok";
  plan: string;
  capabilities: Record<CapabilityKey, boolean> & Record<string, boolean>;
  // optional future fields:
  usage?: { properties?: number; units?: number; screeningsThisMonth?: number };
  integrity?: any;
};
