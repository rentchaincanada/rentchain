import type { Firestore } from "firebase-admin/firestore";
import type { RiskGrade } from "./riskTypes";

export const PROPERTY_CREDIBILITY_LOW_CONFIDENCE_THRESHOLD = 0.65;

export type PropertyCredibilityHealthStatus = "strong" | "watch" | "limited-data" | "unknown";

export type PropertyCredibilitySummary = {
  propertyId: string;
  tenantScoreAverage: number | null;
  tenantScoreGradeAverage: RiskGrade | null;
  leaseRiskAverage: number | null;
  leaseRiskGradeAverage: RiskGrade | null;
  activeLeaseCount: number;
  tenantsWithScoreCount: number;
  leasesWithRiskCount: number;
  lowConfidenceCount: number;
  missingCredibilityCount: number;
  healthStatus: PropertyCredibilityHealthStatus;
};

export type PropertyCredibilityLeaseRecord = {
  id: string;
  status?: string | null;
  tenantId?: string | null;
  tenantIds?: string[];
  riskScore?: number | null;
  riskGrade?: string | null;
  riskConfidence?: number | null;
};

type TenantCredibilityRecord = {
  id: string;
  tenantScoreValue: number | null;
  tenantScoreGrade: string | null;
  tenantScoreConfidence: number | null;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
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

function toTenantIds(lease: PropertyCredibilityLeaseRecord): string[] {
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

export function computePropertyCredibilitySummary(input: {
  propertyId: string;
  leases: PropertyCredibilityLeaseRecord[];
  tenants: TenantCredibilityRecord[];
}): PropertyCredibilitySummary {
  const activeLeases = input.leases.filter((lease) => isActiveLeaseStatus(lease.status));
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

  const tenants = uniqueTenantIds
    .map((tenantId) => tenantMap.get(tenantId))
    .filter((tenant): tenant is TenantCredibilityRecord => Boolean(tenant));
  const tenantScores = tenants
    .map((tenant) => asNumber(tenant.tenantScoreValue))
    .filter((value): value is number => value != null);
  const tenantConfidenceCount = tenants.filter((tenant) => {
    const confidence = asNumber(tenant.tenantScoreConfidence);
    return confidence != null && confidence < PROPERTY_CREDIBILITY_LOW_CONFIDENCE_THRESHOLD;
  }).length;
  const tenantMissingCount = uniqueTenantIds.filter((tenantId) => {
    const tenant = tenantMap.get(tenantId);
    return !tenant || asNumber(tenant.tenantScoreValue) == null;
  }).length;

  const tenantScoreAverage = average(tenantScores);
  const leaseRiskAverage = average(leaseScores);
  const activeLeaseCount = activeLeases.length;
  const tenantsWithScoreCount = tenantScores.length;
  const leasesWithRiskCount = leaseScores.length;
  const lowConfidenceCount = leaseConfidenceCount + tenantConfidenceCount;
  const missingCredibilityCount = leaseMissingCount + tenantMissingCount;
  const totalEvidenceSlots = activeLeaseCount + uniqueTenantIds.length;
  const usableEvidenceCount = tenantsWithScoreCount + leasesWithRiskCount;
  const summaryAverage = average([tenantScoreAverage, leaseRiskAverage].filter((value): value is number => value != null));

  let healthStatus: PropertyCredibilityHealthStatus = "unknown";
  if (totalEvidenceSlots === 0) {
    healthStatus = "unknown";
  } else if (usableEvidenceCount === 0 || missingCredibilityCount / totalEvidenceSlots >= 0.4) {
    healthStatus = "limited-data";
  } else if ((summaryAverage ?? 0) >= 75 && lowConfidenceCount <= 1 && missingCredibilityCount <= 1) {
    healthStatus = "strong";
  } else {
    healthStatus = "watch";
  }

  return {
    propertyId: input.propertyId,
    tenantScoreAverage,
    tenantScoreGradeAverage: gradeFromScore(tenantScoreAverage),
    leaseRiskAverage,
    leaseRiskGradeAverage: gradeFromScore(leaseRiskAverage),
    activeLeaseCount,
    tenantsWithScoreCount,
    leasesWithRiskCount,
    lowConfidenceCount,
    missingCredibilityCount,
    healthStatus,
  };
}

export async function loadPropertyCredibilitySummary(options: {
  firestore: Pick<Firestore, "collection">;
  propertyId: string;
  landlordId?: string | null;
  leases: PropertyCredibilityLeaseRecord[];
}): Promise<PropertyCredibilitySummary> {
  const tenantIds = Array.from(new Set(options.leases.flatMap((lease) => toTenantIds(lease))));
  const tenantSnapshots: Array<TenantCredibilityRecord | null> = await Promise.all(
    tenantIds.map(async (tenantId) => {
      try {
        const snap = await options.firestore.collection("tenants").doc(tenantId).get();
        if (!snap.exists) return null;
        const raw = (snap.data() || {}) as Record<string, unknown>;
        if (options.landlordId) {
          const tenantLandlordId = asTrimmedString(raw.landlordId);
          if (tenantLandlordId && tenantLandlordId !== asTrimmedString(options.landlordId)) {
            return null;
          }
        }
        return {
          id: snap.id,
          tenantScoreValue: asNumber(raw.tenantScoreValue ?? (raw.tenantScore as any)?.score),
          tenantScoreGrade: asTrimmedString(raw.tenantScoreGrade ?? (raw.tenantScore as any)?.grade) || null,
          tenantScoreConfidence: asNumber(raw.tenantScoreConfidence ?? (raw.tenantScore as any)?.confidence),
        };
      } catch {
        return null;
      }
    })
  );

  return computePropertyCredibilitySummary({
    propertyId: options.propertyId,
    leases: options.leases,
    tenants: tenantSnapshots.filter((tenant): tenant is TenantCredibilityRecord => Boolean(tenant)),
  });
}
