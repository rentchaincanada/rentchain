import type { TenantScore, TenantScoreGrade, TenantScoreInput } from "./tenantScoreTypes";

const TENANT_SCORE_VERSION = "tenant-score-v1";

type FactorKey = keyof TenantScore["factors"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function gradeFor(score: number): TenantScoreGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function leaseRiskFactor(input: TenantScoreInput): number | null {
  const latest = toNumberOrNull(input.latestLeaseRiskScore);
  const average = toNumberOrNull(input.averageLeaseRiskScore);
  if (latest == null && average == null) return null;
  if (latest != null && average != null) return clamp(round(latest * 0.6 + average * 0.4), 0, 100);
  return clamp(round((latest ?? average) as number), 0, 100);
}

function paymentBehaviorFactor(input: TenantScoreInput): number | null {
  const onTimeRatio = toNumberOrNull(input.onTimePaymentRatio);
  const latePayments = toNumberOrNull(input.latePayments) ?? 0;
  const missedPayments = toNumberOrNull(input.missedPayments) ?? 0;
  const nsfCount = toNumberOrNull(input.nsfCount) ?? 0;
  const evictionNoticeCount = toNumberOrNull(input.evictionNoticeCount) ?? 0;
  const positiveNotesCount = toNumberOrNull(input.positiveNotesCount) ?? 0;

  const hasEvidence =
    onTimeRatio != null || latePayments > 0 || missedPayments > 0 || nsfCount > 0 || evictionNoticeCount > 0 || positiveNotesCount > 0;
  if (!hasEvidence) return null;

  let score = onTimeRatio != null ? 45 + onTimeRatio * 40 : 68;
  score -= latePayments * 7;
  score -= missedPayments * 10;
  score -= nsfCount * 12;
  score -= evictionNoticeCount * 18;
  score += Math.min(positiveNotesCount * 2, 8);
  return clamp(round(score), 0, 100);
}

function stabilityFactor(input: TenantScoreInput): number | null {
  const activeLeaseCount = Math.max(0, toNumberOrNull(input.activeLeaseCount) ?? 0);
  const completedLeaseCount = Math.max(0, toNumberOrNull(input.completedLeaseCount) ?? 0);
  const total = activeLeaseCount + completedLeaseCount;
  if (total <= 0) return null;

  let score = 52;
  if (activeLeaseCount > 0) score += 8;
  score += Math.min(completedLeaseCount * 9, 27);
  score += Math.min(total * 3, 12);
  return clamp(round(score), 0, 100);
}

function historyDepthFactor(input: TenantScoreInput): number | null {
  const evidenceLeaseCount = Math.max(0, toNumberOrNull(input.evidenceLeaseCount) ?? 0);
  const paymentEvidence =
    (toNumberOrNull(input.latePayments) ?? 0) +
    (toNumberOrNull(input.missedPayments) ?? 0) +
    (toNumberOrNull(input.positiveNotesCount) ?? 0) +
    ((toNumberOrNull(input.onTimePaymentRatio) ?? null) != null ? 1 : 0);

  if (evidenceLeaseCount <= 0 && paymentEvidence <= 0) return null;

  let score = 48;
  score += Math.min(evidenceLeaseCount * 10, 30);
  score += Math.min(paymentEvidence * 3, 12);
  return clamp(round(score), 0, 100);
}

function confidenceFor(input: TenantScoreInput, factors: TenantScore["factors"]): number {
  const presentCount = (Object.values(factors).filter((value) => typeof value === "number").length);
  const evidenceLeaseCount = Math.max(0, toNumberOrNull(input.evidenceLeaseCount) ?? 0);
  const paymentEvidence =
    (toNumberOrNull(input.onTimePaymentRatio) ?? null) != null ||
    (toNumberOrNull(input.latePayments) ?? 0) > 0 ||
    (toNumberOrNull(input.missedPayments) ?? 0) > 0 ||
    (toNumberOrNull(input.nsfCount) ?? 0) > 0 ||
    (toNumberOrNull(input.evictionNoticeCount) ?? 0) > 0;

  let confidence = 0.45;
  confidence += presentCount * 0.07;
  if (evidenceLeaseCount >= 1) confidence += 0.05;
  if (evidenceLeaseCount >= 2) confidence += 0.04;
  if (paymentEvidence) confidence += 0.08;
  return clamp(round(confidence), 0.45, 0.95);
}

function pushUnique(target: string[], value: string | null | undefined) {
  const next = String(value || "").trim();
  if (!next || target.includes(next)) return;
  target.push(next);
}

function buildSignals(input: TenantScoreInput, factors: TenantScore["factors"]): string[] {
  const signals: string[] = [];
  const latestLeaseRiskScore = toNumberOrNull(input.latestLeaseRiskScore);
  const onTimePaymentRatio = toNumberOrNull(input.onTimePaymentRatio);
  const latePayments = toNumberOrNull(input.latePayments) ?? 0;
  const missedPayments = toNumberOrNull(input.missedPayments) ?? 0;
  const nsfCount = toNumberOrNull(input.nsfCount) ?? 0;
  const evictionNoticeCount = toNumberOrNull(input.evictionNoticeCount) ?? 0;
  const completedLeaseCount = toNumberOrNull(input.completedLeaseCount) ?? 0;
  const evidenceLeaseCount = toNumberOrNull(input.evidenceLeaseCount) ?? 0;

  if (latestLeaseRiskScore != null && latestLeaseRiskScore >= 80) pushUnique(signals, "strong_recent_lease_profile");
  if (latestLeaseRiskScore != null && latestLeaseRiskScore < 55) pushUnique(signals, "elevated_recent_lease_risk");
  if (onTimePaymentRatio != null && onTimePaymentRatio >= 0.9) pushUnique(signals, "strong_on_time_payment_history");
  if (onTimePaymentRatio != null && onTimePaymentRatio < 0.75) pushUnique(signals, "payment_reliability_needs_review");
  if (latePayments >= 2) pushUnique(signals, "repeated_late_payments");
  if (missedPayments >= 1) pushUnique(signals, "missed_payment_history");
  if (nsfCount >= 1) pushUnique(signals, "nsf_history_present");
  if (evictionNoticeCount >= 1) pushUnique(signals, "eviction_notice_history_present");
  if (completedLeaseCount >= 1) pushUnique(signals, "completed_lease_history_present");
  if (evidenceLeaseCount <= 1 || Object.values(factors).filter((value) => typeof value === "number").length <= 2) {
    pushUnique(signals, "limited_history_depth");
  }

  return signals;
}

function buildRecommendations(input: TenantScoreInput, factors: TenantScore["factors"]): string[] {
  const recommendations: string[] = [];
  const latestLeaseRiskScore = toNumberOrNull(input.latestLeaseRiskScore);
  const onTimePaymentRatio = toNumberOrNull(input.onTimePaymentRatio);
  const latePayments = toNumberOrNull(input.latePayments) ?? 0;
  const missedPayments = toNumberOrNull(input.missedPayments) ?? 0;
  const nsfCount = toNumberOrNull(input.nsfCount) ?? 0;
  const evictionNoticeCount = toNumberOrNull(input.evictionNoticeCount) ?? 0;
  const evidenceLeaseCount = toNumberOrNull(input.evidenceLeaseCount) ?? 0;

  if (latestLeaseRiskScore != null && latestLeaseRiskScore < 60) {
    pushUnique(recommendations, "Review the most recent lease risk snapshot before relying on this tenant score.");
  }
  if (onTimePaymentRatio != null && onTimePaymentRatio < 0.8) {
    pushUnique(recommendations, "Verify recent payment consistency and open balances before extending additional trust.");
  }
  if (latePayments >= 2 || missedPayments >= 1 || nsfCount >= 1) {
    pushUnique(recommendations, "Inspect ledger history for repeated late, missed, or returned-payment events.");
  }
  if (evictionNoticeCount >= 1) {
    pushUnique(recommendations, "Confirm the context of any eviction-related notice history before using this score operationally.");
  }
  if (evidenceLeaseCount <= 1 || factors.historyDepth == null) {
    pushUnique(recommendations, "Treat this score as low-history guidance until more lease or payment evidence is available.");
  }
  if (!recommendations.length) {
    pushUnique(recommendations, "Continue monitoring lease and payment signals as new history is recorded.");
  }
  return recommendations;
}

export function computeTenantScore(input: TenantScoreInput): TenantScore {
  const factors: TenantScore["factors"] = {
    leaseRisk: leaseRiskFactor(input),
    paymentBehavior: paymentBehaviorFactor(input),
    stability: stabilityFactor(input),
    historyDepth: historyDepthFactor(input),
  };

  const weighted: Array<{ key: FactorKey; weight: number }> = [
    { key: "leaseRisk", weight: 0.45 },
    { key: "paymentBehavior", weight: 0.25 },
    { key: "stability", weight: 0.2 },
    { key: "historyDepth", weight: 0.1 },
  ];

  let totalWeight = 0;
  let weightedScore = 0;
  for (const item of weighted) {
    const value = factors[item.key];
    if (typeof value !== "number") continue;
    totalWeight += item.weight;
    weightedScore += value * item.weight;
  }

  const score = clamp(round(totalWeight > 0 ? weightedScore / totalWeight : 60), 0, 100);
  const confidence = confidenceFor(input, factors);
  const signals = buildSignals(input, factors);
  const recommendations = buildRecommendations(input, factors);

  return {
    version: TENANT_SCORE_VERSION,
    score,
    grade: gradeFor(score),
    confidence,
    factors,
    signals,
    recommendations,
    derivedFrom: {
      activeLeaseCount: Math.max(0, toNumberOrNull(input.activeLeaseCount) ?? 0),
      completedLeaseCount: Math.max(0, toNumberOrNull(input.completedLeaseCount) ?? 0),
      latestLeaseRiskScore: toNumberOrNull(input.latestLeaseRiskScore),
      averageLeaseRiskScore: toNumberOrNull(input.averageLeaseRiskScore),
      onTimePaymentRatio: toNumberOrNull(input.onTimePaymentRatio),
    },
    generatedAt: new Date().toISOString(),
  };
}
