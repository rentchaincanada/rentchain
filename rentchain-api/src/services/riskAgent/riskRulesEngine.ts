import { clamp, confidenceBandForValue, gradeForScore, roundTo } from "./riskScoring";
import type {
  RiskAgentApplicationContext,
  RiskAgentEvaluation,
  RiskAgentFactorImpact,
  RiskAgentInputs,
  RiskAgentStatus,
} from "./riskTypes";

type WorkingState = {
  score: number;
  factors: RiskAgentEvaluation["factors"];
  flags: string[];
  recommendations: string[];
  manualReview: boolean;
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function pushFactor(
  state: WorkingState,
  params: {
    code: string;
    label: string;
    impact: RiskAgentFactorImpact;
    weight: number;
    flag?: string | null;
    recommendation?: string | null;
  }
) {
  state.factors.push({
    code: params.code,
    label: params.label,
    impact: params.impact,
    weight: params.weight,
  });

  if (params.impact === "positive") {
    state.score += params.weight;
  } else if (params.impact === "negative") {
    state.score -= params.weight;
  }

  if (params.flag) state.flags.push(params.flag);
  if (params.recommendation) state.recommendations.push(params.recommendation);
}

function buildInputs(context: RiskAgentApplicationContext): RiskAgentInputs {
  const incomeToRentRatio =
    typeof context.monthlyIncome === "number" &&
    Number.isFinite(context.monthlyIncome) &&
    context.monthlyIncome > 0 &&
    typeof context.monthlyRent === "number" &&
    Number.isFinite(context.monthlyRent) &&
    context.monthlyRent > 0
      ? roundTo(context.monthlyIncome / context.monthlyRent, 2)
      : null;

  return {
    monthlyIncome: context.monthlyIncome,
    monthlyRent: context.monthlyRent,
    incomeToRentRatio,
    identityStatus: context.identityStatus,
    documentStatus: context.documentStatus,
    employmentMonths: context.employmentMonths,
    coTenantCount: context.coTenantCount,
    applicationCompleteness: context.applicationCompleteness,
    paymentHistoryRatio: context.paymentHistoryRatio,
    latePayments: context.latePayments,
    leaseApplicationConsistency: context.leaseApplicationConsistency,
  };
}

function evaluateIncome(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.incomeToRentRatio == null) {
    pushFactor(state, {
      code: "income_data_incomplete",
      label: "Income or rent data incomplete",
      impact: "negative",
      weight: 10,
      flag: "Income verification incomplete",
      recommendation: "Request additional income documentation before relying on this assessment.",
    });
    return;
  }

  if (inputs.incomeToRentRatio >= 3) {
    pushFactor(state, {
      code: "income_to_rent_strong",
      label: "Income comfortably covers rent",
      impact: "positive",
      weight: 18,
    });
    return;
  }

  if (inputs.incomeToRentRatio >= 2.3) {
    pushFactor(state, {
      code: "income_to_rent_acceptable",
      label: "Income covers rent within preferred range",
      impact: "positive",
      weight: 10,
    });
    return;
  }

  if (inputs.incomeToRentRatio >= 1.8) {
    pushFactor(state, {
      code: "income_to_rent_tight",
      label: "Income-to-rent coverage is tighter than preferred",
      impact: "negative",
      weight: 8,
      flag: "Income-to-rent coverage is tight",
      recommendation: "Review income stability and ask for any missing income verification.",
    });
    return;
  }

  pushFactor(state, {
    code: "income_to_rent_low",
    label: "Income is below preferred rent coverage threshold",
    impact: "negative",
    weight: 18,
    flag: "Income below preferred threshold",
    recommendation: "Request additional income documentation or guarantor support.",
  });
}

function evaluateIdentity(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.identityStatus === "verified") {
    pushFactor(state, {
      code: "identity_verified",
      label: "Identity verification completed",
      impact: "positive",
      weight: 8,
    });
    return;
  }

  if (inputs.identityStatus === "pending") {
    pushFactor(state, {
      code: "identity_pending",
      label: "Identity verification is still pending",
      impact: "negative",
      weight: 4,
      flag: "Identity verification pending",
      recommendation: "Wait for identity verification to complete before making a final decision.",
    });
    return;
  }

  if (inputs.identityStatus === "needs_review") {
    state.manualReview = true;
    pushFactor(state, {
      code: "identity_review_needed",
      label: "Identity verification needs manual review",
      impact: "negative",
      weight: 14,
      flag: "Identity verification needs manual review",
      recommendation: "Review identity verification exceptions before proceeding.",
    });
    return;
  }

  pushFactor(state, {
    code: "identity_unverified",
    label: "Identity verification is not available",
    impact: "negative",
    weight: 10,
    flag: "Identity verification incomplete",
    recommendation: "Verify identity details before relying on this assessment.",
  });
}

function evaluateDocuments(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.documentStatus === "verified") {
    pushFactor(state, {
      code: "documents_complete",
      label: "Required application documents appear complete",
      impact: "positive",
      weight: 6,
    });
    return;
  }

  if (inputs.documentStatus === "pending") {
    pushFactor(state, {
      code: "documents_pending",
      label: "Documents have been submitted but not fully cleared",
      impact: "negative",
      weight: 4,
      flag: "Supporting documents are still pending review",
      recommendation: "Confirm document review has completed before final approval.",
    });
    return;
  }

  if (inputs.documentStatus === "needs_review") {
    state.manualReview = true;
    pushFactor(state, {
      code: "documents_need_review",
      label: "Application documents need review",
      impact: "negative",
      weight: 10,
      flag: "Documents need manual review",
      recommendation: "Review uploaded documents and resolve any checklist issues.",
    });
    return;
  }

  pushFactor(state, {
    code: "documents_missing",
    label: "Critical application documents are missing",
    impact: "negative",
    weight: 12,
    flag: "Missing required documents",
    recommendation: "Request the missing application documents before making a final decision.",
  });
}

function evaluateEmployment(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.employmentMonths == null) {
    pushFactor(state, {
      code: "employment_history_unknown",
      label: "Employment history is incomplete",
      impact: "negative",
      weight: 6,
      flag: "Employment history incomplete",
      recommendation: "Confirm employment duration with the applicant or employer reference.",
    });
    return;
  }

  if (inputs.employmentMonths >= 24) {
    pushFactor(state, {
      code: "employment_stable",
      label: "Employment history shows stability",
      impact: "positive",
      weight: 8,
    });
    return;
  }

  if (inputs.employmentMonths >= 12) {
    pushFactor(state, {
      code: "employment_established",
      label: "Employment history is established",
      impact: "positive",
      weight: 4,
    });
    return;
  }

  if (inputs.employmentMonths >= 6) {
    return;
  }

  pushFactor(state, {
    code: "employment_short",
    label: "Employment history is shorter than preferred",
    impact: "negative",
    weight: 8,
    flag: "Short employment history",
    recommendation: "Confirm employment stability with an employer reference.",
  });
}

function evaluateCompleteness(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.applicationCompleteness == null) {
    pushFactor(state, {
      code: "application_completeness_unknown",
      label: "Application completeness could not be determined",
      impact: "negative",
      weight: 6,
      flag: "Application completeness is unclear",
      recommendation: "Review the application for missing information before deciding.",
    });
    return;
  }

  if (inputs.applicationCompleteness >= 0.9) {
    pushFactor(state, {
      code: "application_complete",
      label: "Application is materially complete",
      impact: "positive",
      weight: 10,
    });
    return;
  }

  if (inputs.applicationCompleteness >= 0.75) {
    pushFactor(state, {
      code: "application_mostly_complete",
      label: "Application is mostly complete",
      impact: "positive",
      weight: 4,
    });
    return;
  }

  if (inputs.applicationCompleteness >= 0.55) {
    pushFactor(state, {
      code: "application_partially_complete",
      label: "Application is only partially complete",
      impact: "negative",
      weight: 4,
      flag: "Application has missing information",
      recommendation: "Fill in the remaining application details before making a final decision.",
    });
    return;
  }

  pushFactor(state, {
    code: "application_incomplete",
    label: "Application is incomplete",
    impact: "negative",
    weight: 12,
    flag: "Application is missing required information",
    recommendation: "Complete the application before relying on a risk decision.",
  });
}

function evaluatePaymentHistory(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.paymentHistoryRatio == null && inputs.latePayments == null) {
    return;
  }

  if ((inputs.latePayments || 0) >= 2) {
    pushFactor(state, {
      code: "late_payment_history",
      label: "Past payment behavior shows repeated late payments",
      impact: "negative",
      weight: 10,
      flag: "Repeated late payment history",
      recommendation: "Review available payment history before approving this file.",
    });
    return;
  }

  if (inputs.paymentHistoryRatio != null && inputs.paymentHistoryRatio >= 0.97) {
    pushFactor(state, {
      code: "payment_history_strong",
      label: "Payment history proxy is strong",
      impact: "positive",
      weight: 8,
    });
    return;
  }

  if (inputs.paymentHistoryRatio != null && inputs.paymentHistoryRatio >= 0.9) {
    pushFactor(state, {
      code: "payment_history_acceptable",
      label: "Payment history proxy is acceptable",
      impact: "positive",
      weight: 4,
    });
    return;
  }

  if (inputs.paymentHistoryRatio != null && inputs.paymentHistoryRatio < 0.8) {
    pushFactor(state, {
      code: "payment_history_concerning",
      label: "Payment history proxy is below preferred range",
      impact: "negative",
      weight: 8,
      flag: "Payment history needs closer review",
      recommendation: "Review payment history and ask follow-up questions before finalizing.",
    });
  }
}

function evaluateCoTenants(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.coTenantCount == null || inputs.coTenantCount <= 1) return;

  if (inputs.coTenantCount >= 3) {
    pushFactor(state, {
      code: "multiple_cotenants",
      label: "Multiple co-tenants increase file complexity",
      impact: "negative",
      weight: 6,
      flag: "Multiple co-tenants require coordinated review",
      recommendation: "Confirm all co-tenant identities and supporting documents are complete.",
    });
    return;
  }

  pushFactor(state, {
    code: "co_tenant_present",
    label: "Co-tenant information needs to be reviewed together",
    impact: "negative",
    weight: 3,
    flag: "Co-tenant information should be reviewed together",
    recommendation: "Check that co-tenant income and document coverage are complete.",
  });
}

function evaluateConsistency(state: WorkingState, inputs: RiskAgentInputs) {
  if (inputs.leaseApplicationConsistency === "aligned") {
    pushFactor(state, {
      code: "application_lease_aligned",
      label: "Application and linked lease context are aligned",
      impact: "positive",
      weight: 4,
    });
    return;
  }

  if (inputs.leaseApplicationConsistency === "conflict") {
    state.manualReview = true;
    pushFactor(state, {
      code: "application_lease_conflict",
      label: "Application and linked lease context conflict",
      impact: "negative",
      weight: 12,
      flag: "Lease and application context conflict",
      recommendation: "Review lease and application linkage before making a final decision.",
    });
  }
}

function resolveStatus(inputs: RiskAgentInputs, state: WorkingState): RiskAgentStatus {
  const coreSignals = [
    inputs.monthlyIncome != null && inputs.monthlyRent != null,
    inputs.identityStatus !== "unknown",
    inputs.documentStatus !== "unknown",
    inputs.applicationCompleteness != null,
    inputs.employmentMonths != null,
  ].filter(Boolean).length;

  if (coreSignals < 3) return "insufficient_data";
  if (state.manualReview) return "manual_review_required";
  return "completed";
}

function deriveConfidence(inputs: RiskAgentInputs, status: RiskAgentStatus): number {
  const coreSignals = [
    inputs.monthlyIncome != null && inputs.monthlyRent != null,
    inputs.identityStatus !== "unknown",
    inputs.documentStatus !== "unknown",
    inputs.applicationCompleteness != null,
    inputs.employmentMonths != null,
  ].filter(Boolean).length;

  const supportSignals = [inputs.paymentHistoryRatio != null || inputs.latePayments != null, inputs.coTenantCount != null].filter(Boolean).length;

  let confidence = 0.42 + coreSignals * 0.08 + supportSignals * 0.03;
  if (inputs.applicationCompleteness != null && inputs.applicationCompleteness < 0.75) confidence -= 0.05;
  if (inputs.applicationCompleteness != null && inputs.applicationCompleteness < 0.55) confidence -= 0.05;
  if (inputs.leaseApplicationConsistency === "conflict") confidence -= 0.08;
  if (status === "manual_review_required") confidence -= 0.05;
  if (status === "insufficient_data") confidence = Math.min(confidence - 0.1, 0.58);
  return roundTo(clamp(confidence, 0.35, 0.95), 2);
}

export function evaluateRiskAgentContext(context: RiskAgentApplicationContext): RiskAgentEvaluation {
  const inputs = buildInputs(context);
  const state: WorkingState = {
    score: 60,
    factors: [],
    flags: [],
    recommendations: [],
    manualReview: false,
  };

  evaluateIncome(state, inputs);
  evaluateIdentity(state, inputs);
  evaluateDocuments(state, inputs);
  evaluateEmployment(state, inputs);
  evaluateCompleteness(state, inputs);
  evaluatePaymentHistory(state, inputs);
  evaluateCoTenants(state, inputs);
  evaluateConsistency(state, inputs);

  const status = resolveStatus(inputs, state);
  const score = Math.round(clamp(state.score, 0, 100));
  const confidence = deriveConfidence(inputs, status);

  return {
    version: "risk-v1",
    score,
    grade: gradeForScore(score),
    confidence,
    confidenceBand: confidenceBandForValue(confidence),
    status,
    factors: state.factors,
    flags: unique(state.flags),
    recommendations: unique(state.recommendations).slice(0, 6),
    inputs,
    createdAt: new Date().toISOString(),
  };
}
