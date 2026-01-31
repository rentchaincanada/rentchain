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
  | "team.invites"
  | "properties"
  | "units";

export type PlanTier = "free" | "starter" | "pro" | "business";

export const CAPABILITIES: Record<PlanTier, Record<CapabilityKey, boolean>> = {
  free: {
    applications: true,
    tenant_invites: true,
    properties_unlimited: true,
    units_unlimited: true,
    screening: true,
    ledger_basic: false,
    ledger_verified: false,
    exports_basic: false,
    exports_advanced: false,
    compliance_reports: false,
    audit_logs: false,
    ai_summaries: false,
    portfolio_analytics: false,
    unitsTable: true,
    leases: false,
    ledger: false,
    maintenance: false,
    notices: false,
    messaging: false,
    tenantPortal: false,
    exports: false,
    "team.invites": true,
    properties: true,
    units: true,
  },
  starter: {
    applications: true,
    tenant_invites: true,
    properties_unlimited: true,
    units_unlimited: true,
    screening: true,
    ledger_basic: true,
    ledger_verified: false,
    exports_basic: false,
    exports_advanced: false,
    compliance_reports: false,
    audit_logs: false,
    ai_summaries: false,
    portfolio_analytics: false,
    unitsTable: true,
    leases: true,
    ledger: true,
    maintenance: true,
    notices: true,
    messaging: false,
    tenantPortal: true,
    exports: false,
    "team.invites": true,
    properties: true,
    units: true,
  },
  pro: {
    applications: true,
    tenant_invites: true,
    properties_unlimited: true,
    units_unlimited: true,
    screening: true,
    ledger_basic: true,
    ledger_verified: true,
    exports_basic: true,
    exports_advanced: false,
    compliance_reports: false,
    audit_logs: false,
    ai_summaries: false,
    portfolio_analytics: false,
    unitsTable: true,
    leases: true,
    ledger: true,
    maintenance: true,
    notices: true,
    messaging: true,
    tenantPortal: true,
    exports: true,
    "team.invites": true,
    properties: true,
    units: true,
  },
  business: {
    applications: true,
    tenant_invites: true,
    properties_unlimited: true,
    units_unlimited: true,
    screening: true,
    ledger_basic: true,
    ledger_verified: true,
    exports_basic: true,
    exports_advanced: true,
    compliance_reports: true,
    audit_logs: true,
    ai_summaries: true,
    portfolio_analytics: true,
    unitsTable: true,
    leases: true,
    ledger: true,
    maintenance: true,
    notices: true,
    messaging: true,
    tenantPortal: true,
    exports: true,
    "team.invites": true,
    properties: true,
    units: true,
  },
};

export function resolvePlanTier(input?: string | null): PlanTier {
  const plan = String(input || "").trim().toLowerCase();
  if (plan === "starter") return "starter";
  if (plan === "pro") return "pro";
  if (plan === "business" || plan === "elite" || plan === "enterprise") return "business";
  if (plan === "core") return "starter";
  if (plan === "free" || plan === "screening") return "free";
  return "free";
}
