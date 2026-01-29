export type CapabilityKey =
  | "screening"
  | "applications"
  | "unitsTable"
  | "leases"
  | "ledger"
  | "maintenance"
  | "notices"
  | "messaging"
  | "tenantPortal"
  | "exports";

export type PlanTier = "screening" | "starter" | "pro" | "elite";

export const CAPABILITIES: Record<PlanTier, Record<CapabilityKey, boolean>> = {
  screening: {
    screening: true,
    applications: false,
    unitsTable: false,
    leases: false,
    ledger: false,
    maintenance: false,
    notices: false,
    messaging: false,
    tenantPortal: false,
    exports: false,
  },
  starter: {
    screening: true,
    applications: true,
    unitsTable: true,
    leases: true,
    ledger: false,
    maintenance: true,
    notices: true,
    messaging: false,
    tenantPortal: true,
    exports: false,
  },
  pro: {
    screening: true,
    applications: true,
    unitsTable: true,
    leases: true,
    ledger: true,
    maintenance: true,
    notices: true,
    messaging: true,
    tenantPortal: true,
    exports: true,
  },
  elite: {
    screening: true,
    applications: true,
    unitsTable: true,
    leases: true,
    ledger: true,
    maintenance: true,
    notices: true,
    messaging: true,
    tenantPortal: true,
    exports: true,
  },
};

export function resolvePlanTier(input?: string | null): PlanTier {
  const plan = String(input || "").trim().toLowerCase();
  if (plan === "starter" || plan === "pro" || plan === "elite" || plan === "screening") {
    return plan;
  }
  if (plan === "core") return "starter";
  return "screening";
}
