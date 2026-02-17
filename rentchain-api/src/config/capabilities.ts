import {
  allCanonicalCapabilities,
  capabilitiesForPlan,
  resolveCanonicalPlan,
  type Plan,
} from "../services/entitlements/planCapabilities";

export type CapabilityKey = string;

export type PlanTier = Plan;

function toCapabilityRecord(plan: PlanTier): Record<CapabilityKey, boolean> {
  const enabled = new Set(capabilitiesForPlan(plan));
  const record: Record<CapabilityKey, boolean> = {};
  for (const capability of allCanonicalCapabilities()) {
    record[capability] = enabled.has(capability);
  }
  return record;
}

export const CAPABILITIES: Record<PlanTier, Record<CapabilityKey, boolean>> = {
  free: toCapabilityRecord("free"),
  starter: toCapabilityRecord("starter"),
  pro: toCapabilityRecord("pro"),
  elite: toCapabilityRecord("elite"),
};

export function resolvePlanTier(input?: string | null): PlanTier {
  return resolveCanonicalPlan(input);
}
