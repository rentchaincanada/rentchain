import {
  getJurisdictionWorkflowConfig,
  LEGAL_ADVICE_DISCLAIMER,
  normalizeLeaseWorkflowProvince,
  type SupportedLeaseWorkflowProvince,
} from "./leaseWorkflowRegistry";

export type JurisdictionPolicyStatus = "ok" | "review" | "not_applicable" | "unknown";
export type JurisdictionPolicySeverity = "info" | "warning" | "critical";
export type JurisdictionPolicyConfidence = "high" | "medium" | "low";

export type JurisdictionPolicyKey =
  | "lease_renewal_review"
  | "rent_increase_workflow_availability"
  | "notice_workflow_readiness"
  | "move_out_preparation"
  | "deposit_workflow_review"
  | "lease_execution_readiness"
  | "missing_jurisdiction"
  | "unsupported_jurisdiction"
  | "missing_province_property_data";

export type JurisdictionPolicyResult = {
  jurisdiction: SupportedLeaseWorkflowProvince | "UNKNOWN" | "UNSUPPORTED";
  policyKey: JurisdictionPolicyKey;
  status: JurisdictionPolicyStatus;
  severity: JurisdictionPolicySeverity;
  label: string;
  reason: string;
  recommendation: string;
  sourceRuleKey: string;
  confidence: JurisdictionPolicyConfidence;
  legalAdvice: false;
  disclaimer: string;
};

export type EvaluateJurisdictionPolicyInput = {
  province?: unknown;
  propertyProvince?: unknown;
  jurisdictionProvince?: unknown;
  leaseStatus?: unknown;
  leaseStartDate?: unknown;
  leaseEndDate?: unknown;
  leaseExecutionStatus?: unknown;
  leaseLifecycleStatus?: unknown;
  occupancyStatus?: unknown;
  stateCoherence?: {
    coherenceStatus?: unknown;
    flags?: {
      requiresReview?: unknown;
      leaseMarkedActiveBeforeExecution?: unknown;
      activeLeaseOnVacantUnit?: unknown;
      hasStateConflict?: unknown;
    } | null;
  } | null;
  today?: Date | string | number | null;
};

export type JurisdictionPolicyEvaluation = {
  jurisdiction: SupportedLeaseWorkflowProvince | "UNKNOWN" | "UNSUPPORTED";
  results: JurisdictionPolicyResult[];
};

function rawProvince(input: EvaluateJurisdictionPolicyInput): string {
  return String(input.jurisdictionProvince || input.propertyProvince || input.province || "").trim();
}

function normalizedString(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function parseDateOnly(value: unknown): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function daysUntil(dateValue: unknown, todayValue: EvaluateJurisdictionPolicyInput["today"]): number | null {
  const target = parseDateOnly(dateValue);
  const today = parseDateOnly(todayValue || new Date());
  if (!target || !today) return null;
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function result(
  jurisdiction: JurisdictionPolicyResult["jurisdiction"],
  policyKey: JurisdictionPolicyKey,
  input: Omit<JurisdictionPolicyResult, "jurisdiction" | "policyKey" | "legalAdvice" | "disclaimer">
): JurisdictionPolicyResult {
  return {
    jurisdiction,
    policyKey,
    ...input,
    legalAdvice: false,
    disclaimer: LEGAL_ADVICE_DISCLAIMER,
  };
}

export function evaluateJurisdictionPolicy(
  input: EvaluateJurisdictionPolicyInput
): JurisdictionPolicyEvaluation {
  const provinceInput = rawProvince(input);
  if (!provinceInput) {
    return {
      jurisdiction: "UNKNOWN",
      results: [
        result("UNKNOWN", "missing_jurisdiction", {
          status: "review",
          severity: "warning",
          label: "Jurisdiction review needed",
          reason: "No province is available from the lease or property context.",
          recommendation: "Add or verify the property province before relying on province-aware workflow guidance.",
          sourceRuleKey: "jurisdiction.missing_province",
          confidence: "high",
        }),
        result("UNKNOWN", "missing_province_property_data", {
          status: "review",
          severity: "warning",
          label: "Property province missing",
          reason: "Province-aware operational guidance depends on property jurisdiction metadata.",
          recommendation: "Confirm the property province in the property profile.",
          sourceRuleKey: "jurisdiction.property_province_missing",
          confidence: "high",
        }),
      ],
    };
  }

  const province = normalizeLeaseWorkflowProvince(provinceInput);
  if (!province) {
    return {
      jurisdiction: "UNSUPPORTED",
      results: [
        result("UNSUPPORTED", "unsupported_jurisdiction", {
          status: "review",
          severity: "warning",
          label: "Jurisdiction workflow not configured",
          reason: "This province is not part of the current jurisdiction workflow registry.",
          recommendation: "Use general lease operations and verify local requirements outside RentChain.",
          sourceRuleKey: "jurisdiction.unsupported_province",
          confidence: "high",
        }),
      ],
    };
  }

  const config = getJurisdictionWorkflowConfig(province);
  if (!config) {
    return { jurisdiction: "UNSUPPORTED", results: [] };
  }

  const results: JurisdictionPolicyResult[] = [];
  const leaseStatus = normalizedString(input.leaseStatus);
  const executionStatus = normalizedString(input.leaseExecutionStatus);
  const lifecycleStatus = normalizedString(input.leaseLifecycleStatus);
  const coherenceRequiresReview =
    input.stateCoherence?.coherenceStatus === "review_required" ||
    Boolean(input.stateCoherence?.flags?.requiresReview);
  const markedActiveBeforeExecution = Boolean(input.stateCoherence?.flags?.leaseMarkedActiveBeforeExecution);
  const endDateDays = daysUntil(input.leaseEndDate, input.today);
  const hasLeaseEndDate = endDateDays !== null;
  const executionIncomplete =
    Boolean(executionStatus) &&
    executionStatus !== "fully_executed" &&
    executionStatus !== "executed" &&
    executionStatus !== "landlord_signed";

  if (config.leaseLifecycleExpectations.activeRequiresExecutionReview && (markedActiveBeforeExecution || (leaseStatus === "active" && executionIncomplete))) {
    results.push(
      result(province, "lease_execution_readiness", {
        status: "review",
        severity: "warning",
        label: "Lease execution review recommended",
        reason: "The lease appears operationally active while execution signals are not complete.",
        recommendation: "Review the lease package and signature readiness before treating execution as complete.",
        sourceRuleKey: `${province}.lease_execution_readiness`,
        confidence: "medium",
      })
    );
  }

  if (hasLeaseEndDate && endDateDays! >= 0 && endDateDays! <= config.defaultWorkflow.leaseRenewalReminderDays) {
    results.push(
      result(province, "lease_renewal_review", {
        status: "review",
        severity: "info",
        label: "Lease renewal review recommended",
        reason: `The lease end date is within the configured ${config.defaultWorkflow.leaseRenewalReminderDays}-day review window.`,
        recommendation: "Review renewal, continuation, or move-out workflow next steps with the current jurisdiction context.",
        sourceRuleKey: `${province}.lease_renewal_review`,
        confidence: config.confidence,
      })
    );
  }

  if (hasLeaseEndDate && endDateDays! >= 0 && endDateDays! <= config.defaultWorkflow.moveOutPreparationDays) {
    results.push(
      result(province, "move_out_preparation", {
        status: "review",
        severity: "info",
        label: "Move-out preparation review available",
        reason: `The lease end date is within the configured ${config.defaultWorkflow.moveOutPreparationDays}-day move-out preparation window.`,
        recommendation: "Review move-out preparation tasks without assuming legal notice validity from this guidance.",
        sourceRuleKey: `${province}.move_out_preparation`,
        confidence: config.confidence,
      })
    );
  }

  if (config.supportedNoticeTypes.includes("rent_increase")) {
    results.push(
      result(province, "rent_increase_workflow_availability", {
        status: "ok",
        severity: "info",
        label: "Rent increase workflow metadata available",
        reason: "This jurisdiction has rent increase workflow metadata configured for operational review.",
        recommendation: "Use the guided workflow as a review aid and verify current local requirements before sending notices.",
        sourceRuleKey: `${province}.rent_increase_workflow`,
        confidence: config.confidence,
      })
    );
  }

  if (config.supportedNoticeTypes.length > 0) {
    results.push(
      result(province, "notice_workflow_readiness", {
        status: "ok",
        severity: "info",
        label: "Notice workflow guidance available",
        reason: "Province-aware notice workflow metadata is available for landlord review.",
        recommendation: "Prepare notice workflow steps manually and verify local legal requirements before delivery.",
        sourceRuleKey: `${province}.notice_workflow_readiness`,
        confidence: config.confidence,
      })
    );
  }

  if (config.requiresDepositRules) {
    results.push(
      result(province, "deposit_workflow_review", {
        status: "review",
        severity: "info",
        label: "Deposit workflow review available",
        reason: "This jurisdiction has deposit workflow metadata flagged for operational review.",
        recommendation: "Review deposit handling as part of the lease workflow without treating this as a compliance determination.",
        sourceRuleKey: `${province}.deposit_workflow_review`,
        confidence: config.confidence,
      })
    );
  }

  if (coherenceRequiresReview && !results.some((entry) => entry.policyKey === "lease_execution_readiness")) {
    results.unshift(
      result(province, "lease_execution_readiness", {
        status: "review",
        severity: "warning",
        label: "Operational state review recommended",
        reason: "Lease, occupancy, tenant, or payment readiness signals require review.",
        recommendation: "Review the lease operations page before relying on downstream workflow guidance.",
        sourceRuleKey: `${province}.state_coherence_review`,
        confidence: "medium",
      })
    );
  }

  if (results.length === 0 && !lifecycleStatus) {
    results.push(
      result(province, "notice_workflow_readiness", {
        status: "unknown",
        severity: "info",
        label: "Jurisdiction workflow available",
        reason: "Province metadata is available, but lease lifecycle inputs are incomplete.",
        recommendation: "Review lease dates and status before using jurisdiction-aware workflow guidance.",
        sourceRuleKey: `${province}.workflow_available_inputs_incomplete`,
        confidence: "low",
      })
    );
  }

  return { jurisdiction: province, results };
}
