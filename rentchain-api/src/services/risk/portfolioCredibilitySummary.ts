import type { RiskGrade } from "./riskTypes";
import { PROPERTY_CREDIBILITY_LOW_CONFIDENCE_THRESHOLD } from "./propertyCredibilitySummary";

export type PortfolioCredibilityHealthStatus = "strong" | "watch" | "limited-data" | "unknown";

export type PortfolioCredibilitySummary = {
  propertyCount: number;
  activeLeaseCount: number;
  tenantScoreAverage: number | null;
  tenantScoreGradeAverage: RiskGrade | null;
  leaseRiskAverage: number | null;
  leaseRiskGradeAverage: RiskGrade | null;
  tenantsWithScoreCount: number;
  leasesWithRiskCount: number;
  lowConfidenceCount: number;
  missingCredibilityCount: number;
  healthStatus: PortfolioCredibilityHealthStatus;
};

export type PortfolioCredibilityLeaseRecord = {
  id: string;
  propertyId?: string | null;
  status?: string | null;
  tenantId?: string | null;
  tenantIds?: string[];
  riskScore?: number | null;
  riskConfidence?: number | null;
};

type TenantCredibilityRecord = {
  id: string;
  tenantScoreValue: number | null;
  tenantScoreConfidence: number | null;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value == "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function gradeFromScore(score: number | null): RiskGrade | null {
  if (score == null) return null;
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function toTenantIds(lease: PortfolioCredibilityLeaseRecord): string[] {
  const fromArray = Array.isArray(lease.tenantIds)
    ? lease.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  const fallback = asTrimmedString(lease.tenantId);
  return Array.from(new Set([...fromArray, ...(fallback ? [fallback] : [])]));
}

function isActiveLeaseStatus(status: unknown): boolean {
  return new Set(["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"]).has(
    asTrimmedString(status).toLowerCase()
  );
}

export function computePortfolioCredibilitySummary(input: {
  leases: PortfolioCredibilityLeaseRecord[];
  tenants: TenantCredibilityRecord[];
}): PortfolioCredibilitySummary {
  const activeLeases = input.leases.filter((lease) => isActiveLeaseStatus(lease.status));
  const uniquePropertyIds = Array.from(
    new Set(activeLeases.map((lease) => asTrimmedString(lease.propertyId)).filter(Boolean))
  );
  const uniqueTenantIds = Array.from(new Set(activeLeases.flatMap((lease) => toTenantIds(lease))));
  const tenantMap = new Map(input.tenants.map((tenant) => [tenant.id, tenant]));

  const leaseScores = activeLeases
    .map((lease) => asNumber(lease.riskScore))
    .filter((value): value is number => value != null);
  const leaseConfidenceCount = activeLeases.filter((lease) => {
    const confidence = asNumber(lease.riskConfidence);
    return confidence != null && confidence < PROPERTY_CREDIBILITY_LOW_CONFIDENCE_THRESHOLD;
  }).length;
  const leaseMissingCount = activeLeases.filter((lease) => asNumber(lease.riskScore) == null).length;

  const resolvedTenants = uniqueTenantIds
    .map((tenantId) => tenantMap.get(tenantId))
    .filter((tenant): tenant is TenantCredibilityRecord => Boolean(tenant));
  const tenantScores = resolvedTenants
    .map((tenant) => asNumber(tenant.tenantScoreValue))
    .filter((value): value is number => value != null);
  const tenantConfidenceCount = resolvedTenants.filter((tenant) => {
    const confidence = asNumber(tenant.tenantScoreConfidence);
    return confidence != null && confidence < PROPERTY_CREDIBILITY_LOW_CONFIDENCE_THRESHOLD;
  }).length;
  const tenantMissingCount = uniqueTenantIds.filter((tenantId) => {
    const tenant = tenantMap.get(tenantId);
    return !tenant || asNumber(tenant.tenantScoreValue) == null;
  }).length;

  const tenantScoreAverage = average(tenantScores);
  const leaseRiskAverage = average(leaseScores);
  const propertyCount = uniquePropertyIds.length;
  const activeLeaseCount = activeLeases.length;
  const tenantsWithScoreCount = tenantScores.length;
  const leasesWithRiskCount = leaseScores.length;
  const lowConfidenceCount = leaseConfidenceCount + tenantConfidenceCount;
  const missingCredibilityCount = leaseMissingCount + tenantMissingCount;
  const totalEvidenceSlots = activeLeaseCount + uniqueTenantIds.length;
  const usableEvidenceCount = tenantsWithScoreCount + leasesWithRiskCount;
  const summaryAverage = average([tenantScoreAverage, leaseRiskAverage].filter((value): value is number => value != null));

  let healthStatus: PortfolioCredibilityHealthStatus = "unknown";
  if (totalEvidenceSlots === 0) {
    healthStatus = "unknown";
  } else if (usableEvidenceCount === 0 || missingCredibilityCount / totalEvidenceSlots >= 0.4) {
    healthStatus = "limited-data";
  } else if ((summaryAverage ?? 0) >= 75 && lowConfidenceCount <= 2 && missingCredibilityCount <= 2) {
    healthStatus = "strong";
  } else {
    healthStatus = "watch";
  }

  return {
    propertyCount,
    activeLeaseCount,
    tenantScoreAverage,
    tenantScoreGradeAverage: gradeFromScore(tenantScoreAverage),
    leaseRiskAverage,
    leaseRiskGradeAverage: gradeFromScore(leaseRiskAverage),
    tenantsWithScoreCount,
    leasesWithRiskCount,
    lowConfidenceCount,
    missingCredibilityCount,
    healthStatus,
  };
}
