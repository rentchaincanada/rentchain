export type CapabilityKey =
  | "applications"
  | "tenant_invites"
  | "applications_manual"
  | "tenants_manual"
  | "screening_pay_per_use"
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
  | "team.invites"
  | "properties"
  | "units"
  | "portfolio_dashboard";

export type AccountLimitsResponse = {
  status: "ok";
  plan: string;
  capabilities: Record<CapabilityKey, boolean> & Record<string, boolean>;
  // optional future fields:
  usage?: { properties?: number; units?: number; screeningsThisMonth?: number };
  integrity?: any;
};
