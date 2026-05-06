import type {
  AuditComplianceCheck,
  AuditComplianceCheckKey,
  AuditComplianceCheckStatus,
  AuditComplianceReadiness,
  AuditComplianceScope,
  AuditComplianceSeverity,
  DeriveAuditComplianceReadinessInput,
} from "./auditComplianceTypes";

const DEFAULT_DISCLAIMERS = [
  "Readiness only. This is not legal certification.",
  "No external filing or automated reporting is performed.",
  "Manual review is required before sharing or relying on this package.",
];

function asString(value: unknown, max = 240): string {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
}

function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeGeneratedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function cleanId(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function check(
  checkKey: AuditComplianceCheckKey,
  label: string,
  status: AuditComplianceCheckStatus,
  severity: AuditComplianceSeverity,
  evidence: string[] = [],
  missingEvidence: string[] = [],
  blockedReasons: string[] = []
): AuditComplianceCheck {
  return {
    checkKey,
    label,
    status,
    severity,
    evidence,
    missingEvidence,
    blockedReasons,
    manualReviewRequired: true,
  };
}

function countByStatus(checks: AuditComplianceCheck[]) {
  return {
    totalChecks: checks.length,
    passed: checks.filter((item) => item.status === "passed").length,
    needsAttention: checks.filter((item) => item.status === "needs_attention").length,
    blocked: checks.filter((item) => item.status === "blocked").length,
    unavailable: checks.filter((item) => item.status === "unavailable").length,
  };
}

function deriveOverallStatus(checks: AuditComplianceCheck[], hasSourceContext: boolean): AuditComplianceReadiness["status"] {
  if (!hasSourceContext) return "unavailable";
  if (checks.some((item) => item.status === "blocked" && item.severity === "critical")) return "blocked";
  if (checks.some((item) => item.status === "needs_attention")) return "needs_attention";
  return "ready_for_review";
}

function leaseTraceability(input: DeriveAuditComplianceReadinessInput) {
  const leases = arrayOf(input.leases);
  if (!leases.length) {
    return check(
      "lease_traceability",
      "Lease traceability",
      "needs_attention",
      "high",
      [],
      ["No landlord-scoped lease records were available for readiness review."]
    );
  }
  const incomplete = leases.filter((lease) => {
    return !asString(lease.id || lease.leaseId, 240) || !asString(lease.propertyId, 240) || !asString(lease.unitId, 240);
  }).length;
  if (incomplete) {
    return check(
      "lease_traceability",
      "Lease traceability",
      "needs_attention",
      "high",
      [`${leases.length - incomplete} lease records have property and unit linkage.`],
      [`${incomplete} lease records are missing lease, property, or unit traceability fields.`]
    );
  }
  return check("lease_traceability", "Lease traceability", "passed", "high", [
    `${leases.length} lease records include lease, property, and unit traceability.`,
  ]);
}

function delinquencyActionsManualOnly(decisions: NonNullable<DeriveAuditComplianceReadinessInput["decisions"]>) {
  const delinquencyActions = decisions.flatMap((decision) => decision.delinquencyActions || []);
  if (!delinquencyActions.length) {
    return check(
      "delinquency_actions_manual_only",
      "Delinquency actions manual only",
      "unavailable",
      "medium",
      [],
      ["No delinquency action descriptors were present in the landlord-safe decision context."]
    );
  }
  const nonManual = delinquencyActions.filter((action) => action.manualOnly !== true).length;
  if (nonManual) {
    return check(
      "delinquency_actions_manual_only",
      "Delinquency actions manual only",
      "blocked",
      "critical",
      [],
      [],
      [`${nonManual} delinquency action descriptors are not marked manual-only.`]
    );
  }
  return check("delinquency_actions_manual_only", "Delinquency actions manual only", "passed", "medium", [
    `${delinquencyActions.length} delinquency action descriptors are manual-only.`,
  ]);
}

export function deriveAuditComplianceReadiness(
  input: DeriveAuditComplianceReadinessInput
): AuditComplianceReadiness {
  const scope: AuditComplianceScope = input.scope || "landlord_portfolio";
  const landlordId = asString(input.landlordId, 240);
  const propertyId = asString(input.propertyId, 240);
  const leaseId = asString(input.leaseId, 240);
  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const properties = arrayOf(input.properties);
  const leases = arrayOf(input.leases);
  const rentPayments = arrayOf(input.rentPayments);
  const decisions = arrayOf(input.decisions);
  const auditEvents = arrayOf(input.auditEvents);
  const policyEvents = arrayOf(input.policyEvents);
  const exportPackage = input.institutionExportPackage || null;
  const exportSections = exportPackage?.sections || [];
  const exportRedactions = exportPackage?.redactions || [];
  const hasSourceContext = Boolean(landlordId && (properties.length || leases.length || exportPackage));

  const checks: AuditComplianceCheck[] = [
    properties.length
      ? check("property_identity_present", "Property identity present", "passed", "critical", [
          `${properties.length} landlord-scoped property records are available.`,
        ])
      : check(
          "property_identity_present",
          "Property identity present",
          "blocked",
          "critical",
          [],
          [],
          ["At least one landlord-scoped property record is required for readiness review."]
        ),
    leaseTraceability(input),
    exportSections.some((section) => section.sectionKey === "occupancy_summary" && section.status === "included")
      ? check("occupancy_summary_available", "Occupancy summary available", "passed", "medium", [
          "Institution export preview includes occupancy summary metadata.",
        ])
      : check(
          "occupancy_summary_available",
          "Occupancy summary available",
          "needs_attention",
          "medium",
          [],
          ["Occupancy summary metadata is unavailable or incomplete."]
        ),
    rentPayments.length
      ? check("payment_summary_available", "Payment summary available", "passed", "high", [
          `${rentPayments.length} landlord-scoped rent payment records are available for summary review.`,
        ])
      : check(
          "payment_summary_available",
          "Payment summary available",
          leases.length ? "needs_attention" : "unavailable",
          "high",
          [],
          leases.length
            ? ["No landlord-scoped rent payment records were available for readiness review."]
            : ["Payment summary requires lease or rent payment context."]
        ),
    decisions.length
      ? check("decision_workflow_reviewable", "Decision workflow reviewable", "passed", "medium", [
          `${decisions.length} landlord-safe decision inbox items are available.`,
        ])
      : check(
          "decision_workflow_reviewable",
          "Decision workflow reviewable",
          "needs_attention",
          "medium",
          [],
          ["No landlord-safe decision workflow items were available."]
        ),
    delinquencyActionsManualOnly(decisions),
    exportPackage?.manualOnly === true && exportPackage?.externalSubmissionEnabled === false
      ? check("institution_export_preview_only", "Institution export preview only", "passed", "critical", [
          "Institution export package is manual-only with external submission disabled.",
        ])
      : check(
          "institution_export_preview_only",
          "Institution export preview only",
          "blocked",
          "critical",
          [],
          [],
          ["Institution export preview metadata was unavailable or did not confirm preview-only behavior."]
        ),
    auditEvents.length
      ? check("audit_event_coverage", "Audit event coverage", "passed", "medium", [
          `${auditEvents.length} landlord-scoped audit or canonical event records are available.`,
        ])
      : check(
          "audit_event_coverage",
          "Audit event coverage",
          "needs_attention",
          "medium",
          [],
          ["No landlord-scoped audit or canonical event records were available."]
        ),
    policyEvents.length
      ? check("policy_evaluation_available", "Policy evaluation available", "passed", "low", [
          `${policyEvents.length} policy evaluation events are available.`,
        ])
      : check(
          "policy_evaluation_available",
          "Policy evaluation available",
          "unavailable",
          "low",
          [],
          ["No policy evaluation events were available in the landlord-scoped event set."]
        ),
    exportRedactions.length
      ? check("sensitive_data_redacted", "Sensitive data redacted", "passed", "critical", [
          `${exportRedactions.length} sensitive data categories are excluded or redacted.`,
        ])
      : check(
          "sensitive_data_redacted",
          "Sensitive data redacted",
          "blocked",
          "critical",
          [],
          [],
          ["Redaction metadata is required before readiness review."]
        ),
    check("external_submission_disabled", "External submission disabled", "passed", "critical", [
      "External filing is disabled for audit/compliance readiness.",
    ]),
    check("automated_reporting_disabled", "Automated reporting disabled", "passed", "critical", [
      "Automated reporting is disabled for audit/compliance readiness.",
    ]),
  ];

  return {
    readinessId:
      cleanId(`audit_compliance:${scope}:${landlordId || "missing_landlord"}:${propertyId || leaseId || "portfolio"}`) ||
      "audit_compliance:unknown",
    scope,
    status: deriveOverallStatus(checks, hasSourceContext),
    manualOnly: true,
    certificationIssued: false,
    externalFilingEnabled: false,
    automatedReportingEnabled: false,
    generatedAt,
    summary: countByStatus(checks),
    checks,
    redactions: exportRedactions,
    disclaimers: DEFAULT_DISCLAIMERS,
  };
}
