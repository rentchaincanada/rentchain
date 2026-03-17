import type { RiskGrade, RiskInput } from "./riskTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ratioToScore(value: number, excellent: number, poor: number): number {
  if (!Number.isFinite(value)) return 60;
  if (value <= excellent) return 95;
  if (value >= poor) return 25;
  const progress = (value - excellent) / Math.max(poor - excellent, 0.0001);
  return Math.round(95 - progress * 70);
}

export function scoreCredit(creditScore?: number | null): number {
  if (!Number.isFinite(Number(creditScore))) return 60;
  const value = Number(creditScore);
  if (value >= 760) return 95;
  if (value >= 700) return 85;
  if (value >= 660) return 74;
  if (value >= 620) return 62;
  if (value >= 580) return 48;
  return 32;
}

export function scoreIncome(monthlyIncome?: number | null, monthlyRent?: number | null): number {
  const income = Number(monthlyIncome);
  const rent = Number(monthlyRent);
  if (!Number.isFinite(income) || income <= 0 || !Number.isFinite(rent) || rent <= 0) return 60;
  return Math.round(clamp(ratioToScore(rent / income, 0.28, 0.55), 20, 95));
}

export function scorePaymentHistory(onTimePaymentRatio?: number | null, latePayments?: number | null): number {
  const ratio = Number(onTimePaymentRatio);
  const late = Number(latePayments);
  let score = 68;
  if (Number.isFinite(ratio)) {
    score = clamp(Math.round(ratio * 100), 25, 98);
  }
  if (Number.isFinite(late) && late > 0) {
    score = clamp(score - late * 8, 20, 98);
  }
  return Math.round(score);
}

export function scoreEmployment(employmentMonths?: number | null): number {
  const months = Number(employmentMonths);
  if (!Number.isFinite(months) || months < 0) return 62;
  if (months >= 48) return 92;
  if (months >= 24) return 82;
  if (months >= 12) return 72;
  if (months >= 6) return 60;
  return 45;
}

export function scoreBehavior(input: Pick<RiskInput, "coTenantCount" | "hasGuarantor" | "monthlyIncome" | "monthlyRent" | "latePayments">): number {
  let score = 72;
  const coTenantCount = Number(input.coTenantCount);
  if (Number.isFinite(coTenantCount) && coTenantCount >= 3) score -= 8;
  const income = Number(input.monthlyIncome);
  const rent = Number(input.monthlyRent);
  if (Number.isFinite(income) && income > 0 && Number.isFinite(rent) && rent > 0 && rent / income >= 0.45) {
    score -= 8;
  }
  const latePayments = Number(input.latePayments);
  if (Number.isFinite(latePayments) && latePayments >= 2) score -= 10;
  if (input.hasGuarantor === true) score += 8;
  return Math.round(clamp(score, 25, 95));
}

export function gradeForScore(score: number): RiskGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}
