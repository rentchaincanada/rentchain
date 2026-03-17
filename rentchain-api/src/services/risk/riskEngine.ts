import { gradeForScore, scoreBehavior, scoreCredit, scoreEmployment, scoreIncome, scorePaymentHistory } from "./riskRules";
import { CONFIDENCE_BOUNDS, RISK_VERSION, RISK_WEIGHTS } from "./riskWeights";
import type { RiskAssessment, RiskInput } from "./riskTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildFlags(input: Required<RiskAssessment>["inputs"]): string[] {
  const flags: string[] = [];
  const income = numberOrNull(input.monthlyIncome);
  const rent = numberOrNull(input.monthlyRent);
  const ratio = income && rent ? rent / income : null;

  if (ratio != null && ratio >= 0.45) flags.push("High rent-to-income ratio");
  if (numberOrNull(input.latePayments) != null && Number(input.latePayments) >= 2) flags.push("Repeated late payment history");
  if (numberOrNull(input.employmentMonths) != null && Number(input.employmentMonths) < 6) flags.push("Short employment history");
  if (income == null || income <= 0) flags.push("Income verification incomplete");
  if (numberOrNull(input.coTenantCount) != null && Number(input.coTenantCount) >= 3) flags.push("Multiple co-tenants on agreement");
  if ((ratio != null && ratio >= 0.4) && input.hasGuarantor === false) flags.push("No guarantor on elevated-risk lease");
  if (numberOrNull(input.creditScore) == null) flags.push("Credit data unavailable");
  return unique(flags);
}

function buildRecommendations(input: Required<RiskAssessment>["inputs"], flags: string[]): string[] {
  const recommendations: string[] = [];
  const income = numberOrNull(input.monthlyIncome);
  const rent = numberOrNull(input.monthlyRent);
  const ratio = income && rent ? rent / income : null;

  if (ratio != null && ratio >= 0.4) recommendations.push("Verify income documentation before relying on listed rent coverage.");
  if (numberOrNull(input.latePayments) != null && Number(input.latePayments) >= 2) recommendations.push("Review payment history and consider stronger payment controls for this tenancy.");
  if (numberOrNull(input.employmentMonths) != null && Number(input.employmentMonths) < 12) recommendations.push("Confirm employment stability with an updated employer reference.");
  if (income == null || income <= 0) recommendations.push("Collect income verification to improve confidence in this assessment.");
  if (numberOrNull(input.coTenantCount) != null && Number(input.coTenantCount) >= 3) recommendations.push("Confirm all co-tenants are documented on the final lease agreement.");
  if (input.hasGuarantor === false && flags.some((flag) => flag.includes("elevated-risk") || flag.includes("late payment") || flag.includes("rent-to-income"))) {
    recommendations.push("Consider requesting a guarantor or additional assurance for this lease profile.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Use this snapshot alongside your standard screening and document verification workflow.");
  }
  return unique(recommendations).slice(0, 4);
}

export function assessLeaseRisk(input: RiskInput): RiskAssessment {
  const normalizedInputs: RiskAssessment["inputs"] = {
    creditScore: numberOrNull(input.creditScore),
    monthlyIncome: numberOrNull(input.monthlyIncome),
    monthlyRent: numberOrNull(input.monthlyRent),
    employmentMonths: numberOrNull(input.employmentMonths),
    onTimePaymentRatio: numberOrNull(input.onTimePaymentRatio),
    latePayments: numberOrNull(input.latePayments),
    coTenantCount: numberOrNull(input.coTenantCount),
    hasGuarantor: typeof input.hasGuarantor === "boolean" ? input.hasGuarantor : null,
  };

  const factors: RiskAssessment["factors"] = {
    credit: scoreCredit(normalizedInputs.creditScore),
    income: scoreIncome(normalizedInputs.monthlyIncome, normalizedInputs.monthlyRent),
    paymentHistory: scorePaymentHistory(normalizedInputs.onTimePaymentRatio, normalizedInputs.latePayments),
    employment: scoreEmployment(normalizedInputs.employmentMonths),
    behavior: scoreBehavior(normalizedInputs),
  };

  const weightedScore = (
    (factors.credit || 0) * RISK_WEIGHTS.credit +
    (factors.income || 0) * RISK_WEIGHTS.income +
    (factors.paymentHistory || 0) * RISK_WEIGHTS.paymentHistory +
    (factors.employment || 0) * RISK_WEIGHTS.employment +
    (factors.behavior || 0) * RISK_WEIGHTS.behavior
  );

  const coreChecks = [
    normalizedInputs.creditScore != null,
    normalizedInputs.monthlyIncome != null,
    normalizedInputs.monthlyRent != null,
    normalizedInputs.employmentMonths != null,
    normalizedInputs.onTimePaymentRatio != null || normalizedInputs.latePayments != null,
  ];
  const supportChecks = [normalizedInputs.coTenantCount != null, normalizedInputs.hasGuarantor != null];
  const completeness = (coreChecks.filter(Boolean).length + supportChecks.filter(Boolean).length * 0.5) / (coreChecks.length + supportChecks.length * 0.5);
  const confidence = roundConfidence(
    clamp(
      CONFIDENCE_BOUNDS.min + completeness * (CONFIDENCE_BOUNDS.max - CONFIDENCE_BOUNDS.min),
      CONFIDENCE_BOUNDS.min,
      CONFIDENCE_BOUNDS.max
    )
  );

  const flags = buildFlags(normalizedInputs);
  const recommendations = buildRecommendations(normalizedInputs, flags);
  const score = Math.round(clamp(weightedScore, 0, 100));

  return {
    version: RISK_VERSION,
    score,
    grade: gradeForScore(score),
    confidence,
    flags,
    recommendations,
    factors,
    inputs: normalizedInputs,
    generatedAt: new Date().toISOString(),
  };
}

export async function safeAssessLeaseRisk(input: RiskInput): Promise<RiskAssessment | null> {
  try {
    return assessLeaseRisk(input);
  } catch (error) {
    console.warn("[lease-risk] assessment failed", error);
    return null;
  }
}
