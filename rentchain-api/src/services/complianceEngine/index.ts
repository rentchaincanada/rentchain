import { nsComplianceRules } from "./provinces/ns";
import { onComplianceRules } from "./provinces/on";
import { ComplianceProvince, ComplianceRules } from "./types";

const registry: Record<ComplianceProvince, ComplianceRules> = {
  ON: onComplianceRules,
  NS: nsComplianceRules,
};

export function normalizeComplianceProvince(raw: unknown): ComplianceProvince | null {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "ON" || value === "NS") return value;
  return null;
}

export function getComplianceRules(province: ComplianceProvince): ComplianceRules {
  return registry[province];
}

export function listComplianceProvinces(): ComplianceProvince[] {
  return Object.keys(registry) as ComplianceProvince[];
}

export type { ComplianceProvince, ComplianceRules } from "./types";
