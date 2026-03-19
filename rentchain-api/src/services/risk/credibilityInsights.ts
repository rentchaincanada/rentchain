import type { RiskAssessment, RiskGrade } from "./riskTypes";
import type { TenantScore, TenantScoreTimelineEntry } from "./tenantScoreTypes";

export type CredibilityTrend = "up" | "down" | "flat" | "unknown";

export type CredibilityTenantScoreSummary = {
  score: number;
  grade: RiskGrade;
  confidence: number;
  generatedAt: string | null;
  trend: CredibilityTrend;
  signals: string[];
  recommendations: string[];
};

export type CredibilityLeaseRiskSummary = {
  score: number;
  grade: RiskGrade;
  confidence: number;
  generatedAt: string | null;
  flags: string[];
  recommendations: string[];
};

export type CredibilityInsights = {
  tenantScore: CredibilityTenantScoreSummary | null;
  leaseRisk: CredibilityLeaseRiskSummary | null;
};

type TenantScoreCarrier = {
  tenantScore?: TenantScore | null;
  tenantScoreValue?: number | null;
  tenantScoreGrade?: RiskGrade | null;
  tenantScoreConfidence?: number | null;
  tenantScoreTimeline?: TenantScoreTimelineEntry[] | null;
};

function asTrimmedString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function asNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function compactStrings(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function latestTimelineTimestamp(entries: Array<{ generatedAt?: string | null }> | null | undefined): string | null {
  if (!Array.isArray(entries) || !entries.length) return null;
  const latest = entries[entries.length - 1];
  return asTrimmedString(latest?.generatedAt);
}

export function deriveCredibilityTrend(
  entries: Array<{ score?: number | null } | null | undefined> | null | undefined
): CredibilityTrend {
  if (!Array.isArray(entries) || entries.length < 2) return "unknown";
  const latest = asNumber(entries[entries.length - 1]?.score);
  const previous = asNumber(entries[entries.length - 2]?.score);
  if (latest == null || previous == null) return "unknown";
  if (latest === previous) return "flat";
  return latest > previous ? "up" : "down";
}

export function buildCredibilityInsights(input: {
  tenant?: TenantScoreCarrier | null;
  leaseRaw?: Record<string, unknown> | null;
}): CredibilityInsights {
  const tenant = input.tenant || null;
  const tenantScore = tenant?.tenantScore || null;
  const tenantScoreValue = asNumber(tenant?.tenantScoreValue ?? tenantScore?.score);
  const tenantScoreGrade = (asTrimmedString(tenant?.tenantScoreGrade ?? tenantScore?.grade) || null) as RiskGrade | null;
  const tenantScoreConfidence = asNumber(tenant?.tenantScoreConfidence ?? tenantScore?.confidence);
  const tenantScoreTimeline = Array.isArray(tenant?.tenantScoreTimeline) ? tenant!.tenantScoreTimeline! : [];

  const tenantScoreSummary =
    tenantScoreValue != null && tenantScoreGrade && tenantScoreConfidence != null
      ? {
          score: tenantScoreValue,
          grade: tenantScoreGrade,
          confidence: tenantScoreConfidence,
          generatedAt: asTrimmedString(tenantScore?.generatedAt) || latestTimelineTimestamp(tenantScoreTimeline),
          trend: deriveCredibilityTrend(tenantScoreTimeline),
          signals: compactStrings(tenantScore?.signals, 4),
          recommendations: compactStrings(tenantScore?.recommendations, 3),
        }
      : null;

  const leaseRaw = input.leaseRaw || null;
  const leaseRisk = leaseRaw?.risk && typeof leaseRaw.risk === "object" ? (leaseRaw.risk as RiskAssessment) : null;
  const leaseRiskTimeline = Array.isArray(leaseRaw?.riskTimeline)
    ? (leaseRaw!.riskTimeline as Array<{ generatedAt?: string | null }>)
    : [];
  const leaseRiskScore = asNumber(leaseRaw?.riskScore ?? leaseRisk?.score);
  const leaseRiskGrade = (asTrimmedString(leaseRaw?.riskGrade ?? leaseRisk?.grade) || null) as RiskGrade | null;
  const leaseRiskConfidence = asNumber(leaseRaw?.riskConfidence ?? leaseRisk?.confidence);

  const leaseRiskSummary =
    leaseRiskScore != null && leaseRiskGrade && leaseRiskConfidence != null
      ? {
          score: leaseRiskScore,
          grade: leaseRiskGrade,
          confidence: leaseRiskConfidence,
          generatedAt: asTrimmedString(leaseRisk?.generatedAt) || latestTimelineTimestamp(leaseRiskTimeline),
          flags: compactStrings(leaseRisk?.flags, 4),
          recommendations: compactStrings(leaseRisk?.recommendations, 3),
        }
      : null;

  return {
    tenantScore: tenantScoreSummary,
    leaseRisk: leaseRiskSummary,
  };
}
