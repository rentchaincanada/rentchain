import type { PolicyEvaluationRequest, PolicyRule } from "./policyTypes";

export const MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS = 100_000;

function contextFlag(request: PolicyEvaluationRequest, key: string) {
  return Boolean(request.context[key]);
}

function contextNumber(request: PolicyEvaluationRequest, key: string) {
  const value = request.context[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const SCREENING_ACTIONS = ["generate_quote", "start_checkout"] as const;
const LEASE_NOTICE_ACTIONS = ["preview_notice", "send_notice"] as const;

export const policyRules: PolicyRule[] = [
  ...SCREENING_ACTIONS.map(
    (action): PolicyRule => ({
      id: `screening-${action}-provider-unavailable`,
      ruleName: "Block screening when provider health is degraded",
      domain: "screening",
      action,
      enabled: action === "start_checkout",
      priority: 400,
      outcome: "block",
      reasonCode: "SCREENING_PROVIDER_UNAVAILABLE",
      reasonMessage: "Screening cannot continue until the provider is healthy again.",
      severity: "blocking",
      matches: (request) => !contextFlag(request, "providerReady"),
    })
  ),
  ...SCREENING_ACTIONS.map(
    (action): PolicyRule => ({
      id: `screening-${action}-not-eligible`,
      ruleName: "Block screening when the application is not eligible",
      domain: "screening",
      action,
      enabled: true,
      priority: 350,
      outcome: "block",
      reasonCode: "SCREENING_NOT_ELIGIBLE",
      reasonMessage: "Screening is blocked because the application is not eligible.",
      severity: "blocking",
      matches: (request) =>
        !contextFlag(request, "eligible") && String(request.context.eligibilityReasonCode || "") !== "MISSING_CONSENT",
    })
  ),
  ...SCREENING_ACTIONS.map(
    (action): PolicyRule => ({
      id: `screening-${action}-missing-consent`,
      ruleName: "Review screening when consent is missing",
      domain: "screening",
      action,
      enabled: true,
      priority: 300,
      outcome: "review",
      reasonCode: "SCREENING_CONSENT_REVIEW_REQUIRED",
      reasonMessage: "Screening needs manual review because consent or prerequisites are incomplete.",
      severity: "warning",
      matches: (request) => !contextFlag(request, "consentComplete"),
    })
  ),
  ...SCREENING_ACTIONS.map(
    (action): PolicyRule => ({
      id: `screening-${action}-incomplete-data`,
      ruleName: "Review screening when application data is incomplete",
      domain: "screening",
      action,
      enabled: true,
      priority: 250,
      outcome: "review",
      reasonCode: "SCREENING_DATA_INCOMPLETE",
      reasonMessage: "Screening needs manual review because the application data is incomplete.",
      severity: "warning",
      matches: (request) => !contextFlag(request, "applicationDataComplete"),
    })
  ),
  ...SCREENING_ACTIONS.map(
    (action): PolicyRule => ({
      id: `screening-${action}-allow`,
      ruleName: "Allow screening when prerequisites are satisfied",
      domain: "screening",
      action,
      enabled: true,
      priority: 100,
      outcome: "allow",
      reasonCode: "SCREENING_READY",
      reasonMessage: "Screening prerequisites are satisfied.",
      severity: "info",
      matches: () => true,
    })
  ),
  {
    id: "maintenance-approve-cost-missing-evidence",
    ruleName: "Block maintenance cost approval when evidence is missing",
    domain: "maintenance",
    action: "approve_cost",
    enabled: true,
    priority: 400,
    outcome: "block",
    reasonCode: "MAINTENANCE_EVIDENCE_REQUIRED",
    reasonMessage: "Maintenance approval is blocked until evidence or attachments are present.",
    severity: "blocking",
    matches: (request) => !contextFlag(request, "hasSupportingEvidence"),
  },
  {
    id: "maintenance-approve-cost-high-threshold",
    ruleName: "Review maintenance cost approval when cost exceeds threshold",
    domain: "maintenance",
    action: "approve_cost",
    enabled: true,
    priority: 300,
    outcome: "review",
    reasonCode: "MAINTENANCE_COST_REVIEW_REQUIRED",
    reasonMessage: "Maintenance approval needs manual review because the cost exceeds the autopilot threshold.",
    severity: "warning",
    matches: (request) => {
      const amountCents = contextNumber(request, "actualCostCents");
      return typeof amountCents === "number" && amountCents > MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS;
    },
  },
  {
    id: "maintenance-approve-cost-allow",
    ruleName: "Allow maintenance cost approval when evidence exists and cost is within threshold",
    domain: "maintenance",
    action: "approve_cost",
    enabled: true,
    priority: 100,
    outcome: "allow",
    reasonCode: "MAINTENANCE_APPROVAL_READY",
    reasonMessage: "Maintenance approval can proceed.",
    severity: "info",
    matches: () => true,
  },
  {
    id: "maintenance-non-approval-allow",
    ruleName: "Allow non-approval maintenance review decisions",
    domain: "maintenance",
    action: "review_cost",
    enabled: true,
    priority: 100,
    outcome: "allow",
    reasonCode: "MAINTENANCE_REVIEW_READY",
    reasonMessage: "Maintenance review can proceed.",
    severity: "info",
    matches: () => true,
  },
  ...LEASE_NOTICE_ACTIONS.map(
    (action): PolicyRule => ({
      id: `lease-notice-${action}-missing-legal-inputs`,
      ruleName: "Block lease notice automation when required legal inputs are missing",
      domain: "lease_notice",
      action,
      enabled: true,
      priority: 400,
      outcome: "block",
      reasonCode: "LEASE_NOTICE_REQUIRED_INPUTS_MISSING",
      reasonMessage: "Lease notice is blocked until required legal inputs are complete.",
      severity: "blocking",
      matches: (request) => !contextFlag(request, "hasRequiredLegalInputs"),
    })
  ),
  ...LEASE_NOTICE_ACTIONS.map(
    (action): PolicyRule => ({
      id: `lease-notice-${action}-allow`,
      ruleName: "Allow lease notice automation when inputs are valid",
      domain: "lease_notice",
      action,
      enabled: true,
      priority: 100,
      outcome: "allow",
      reasonCode: "LEASE_NOTICE_READY",
      reasonMessage: "Lease notice inputs are complete.",
      severity: "info",
      matches: () => true,
    })
  ),
];

export function getPolicyRules(domain: string, action: string) {
  return policyRules.filter((rule) => rule.enabled && rule.domain === domain && rule.action === action);
}
