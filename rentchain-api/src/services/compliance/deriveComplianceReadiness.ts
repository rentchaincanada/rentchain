export type ComplianceReadinessCheckKey =
  | "schema_validated"
  | "identity_trace_available"
  | "consent_controls_available"
  | "export_tenant_controlled"
  | "sensitive_data_minimized";

export type ComplianceAuditTraceabilityGap =
  | "institutional_export_events_not_recorded"
  | "institutional_handoff_lifecycle_events_limited"
  | "access_audit_summary_not_available";

export type ComplianceReadiness = {
  readinessStatus: "not_ready" | "partial" | "ready";
  readinessLabel: string;
  readinessDescription: string;
  checks: Array<{
    key: ComplianceReadinessCheckKey;
    status: "pass" | "warning" | "missing";
    label: string;
    description: string;
  }>;
  exportTraceability: {
    exportAvailable: boolean;
    schemaVersion: "2.0";
    exportStorage: "not_stored";
    outboundTransfer: "none";
  };
  auditTraceability: {
    traceabilityStatus: "limited" | "ready";
    traceabilityLabel: string;
    traceabilityDescription: string;
    evidenceCoverage: {
      identityTimelineAvailable: boolean;
      exportGeneratedOnDemand: true;
      exportStoredByRentChain: false;
      handoffDraftMetadataAvailable: boolean;
      manualReleasePreparationAvailable: boolean;
      observabilityCoverage: "draft_creation_only" | "none";
      canonicalInstitutionEventsAvailable: false;
    };
    readinessGaps: ComplianceAuditTraceabilityGap[];
  };
};

type DeriveComplianceReadinessInput = {
  validation: {
    status: "valid" | "valid_with_warnings" | "invalid";
    warnings: string[];
    missingRecommendedFields: string[];
  };
  identityTimeline: {
    totalEvents: number;
    recentActivityAvailable: boolean;
  };
  consentControls: {
    sharingEnabled: boolean;
    verificationRequestsAvailable: boolean;
    approvedScopeCount: number;
  };
  exportContext: {
    schemaVersion: "2.0";
    dataScope: "tenant_controlled_export";
    consentRequired: true;
  };
  auditTraceabilityContext: {
    handoffDraftMetadataAvailable: boolean;
    manualReleasePreparationAvailable: boolean;
    observabilityCoverage: "draft_creation_only" | "none";
    canonicalInstitutionEventsAvailable: false;
  };
};

function buildOverallReadiness(
  checks: ComplianceReadiness["checks"]
): Pick<ComplianceReadiness, "readinessStatus" | "readinessLabel" | "readinessDescription"> {
  const hasMissing = checks.some((check) => check.status === "missing");
  if (hasMissing) {
    return {
      readinessStatus: "not_ready",
      readinessLabel: "More readiness details needed",
      readinessDescription:
        "Some required compliance and audit readiness signals are still missing from this tenant-controlled export summary.",
    };
  }

  const hasWarnings = checks.some((check) => check.status === "warning");
  if (hasWarnings) {
    return {
      readinessStatus: "partial",
      readinessLabel: "Partially ready for institutional review",
      readinessDescription:
        "Core export controls are present, but some audit or consent signals are still limited in this tenant-controlled summary.",
    };
  }

  return {
    readinessStatus: "ready",
    readinessLabel: "Ready for structured institutional review",
    readinessDescription:
      "The current tenant-controlled export shows validated structure, traceability, consent-aware controls, and minimized data exposure.",
  };
}

function deriveAuditTraceability(
  input: DeriveComplianceReadinessInput
): ComplianceReadiness["auditTraceability"] {
  const identityTimelineAvailable = input.identityTimeline.totalEvents > 0;
  const evidenceCoverage: ComplianceReadiness["auditTraceability"]["evidenceCoverage"] = {
    identityTimelineAvailable,
    exportGeneratedOnDemand: true,
    exportStoredByRentChain: false,
    handoffDraftMetadataAvailable: input.auditTraceabilityContext.handoffDraftMetadataAvailable,
    manualReleasePreparationAvailable: input.auditTraceabilityContext.manualReleasePreparationAvailable,
    observabilityCoverage: input.auditTraceabilityContext.observabilityCoverage,
    canonicalInstitutionEventsAvailable: input.auditTraceabilityContext.canonicalInstitutionEventsAvailable,
  };

  const readinessGaps: ComplianceAuditTraceabilityGap[] = [
    "institutional_export_events_not_recorded",
    "institutional_handoff_lifecycle_events_limited",
    "access_audit_summary_not_available",
  ];

  const traceabilityStatus =
    identityTimelineAvailable &&
    evidenceCoverage.handoffDraftMetadataAvailable &&
    evidenceCoverage.manualReleasePreparationAvailable &&
    evidenceCoverage.observabilityCoverage === "draft_creation_only"
      ? "ready"
      : "limited";

  if (traceabilityStatus === "ready") {
    return {
      traceabilityStatus,
      traceabilityLabel: "Ready for summary-only review",
      traceabilityDescription:
        "Reduced, tenant-safe audit traceability is available for on-demand exports and metadata-only handoff preparation, with some institutional logging gaps still disclosed.",
      evidenceCoverage,
      readinessGaps,
    };
  }

  return {
    traceabilityStatus,
    traceabilityLabel: "Limited",
    traceabilityDescription:
      "Some reduced audit traceability signals are available, but institutional export and lifecycle evidence coverage is still limited in the current tenant-controlled summary.",
    evidenceCoverage,
    readinessGaps,
  };
}

export function deriveComplianceReadiness(
  input: DeriveComplianceReadinessInput
): ComplianceReadiness {
  const checks: ComplianceReadiness["checks"] = [
    {
      key: "schema_validated",
      status:
        input.validation.status === "valid"
          ? "pass"
          : input.validation.status === "valid_with_warnings"
          ? "warning"
          : "missing",
      label: "Schema validated",
      description:
        input.validation.status === "valid"
          ? "The institutional export structure passed the current required and recommended schema checks."
          : input.validation.status === "valid_with_warnings"
          ? "The institutional export structure is usable, but some recommended schema signals are limited."
          : "The institutional export structure is missing required schema elements.",
    },
    {
      key: "identity_trace_available",
      status: input.identityTimeline.totalEvents > 0 ? "pass" : "warning",
      label: "Identity trace available",
      description:
        input.identityTimeline.totalEvents > 0
          ? "A tenant-safe identity activity trail is available in reduced count and availability form."
          : "Identity traceability signals are still limited in the current reduced audit summary.",
    },
    {
      key: "consent_controls_available",
      status:
        input.consentControls.sharingEnabled &&
        (input.consentControls.verificationRequestsAvailable || input.consentControls.approvedScopeCount > 0)
          ? "pass"
          : input.consentControls.sharingEnabled
          ? "warning"
          : "missing",
      label: "Consent controls available",
      description:
        input.consentControls.sharingEnabled &&
        (input.consentControls.verificationRequestsAvailable || input.consentControls.approvedScopeCount > 0)
          ? "Tenant-controlled sharing and consent-aware access controls are available for this identity context."
          : input.consentControls.sharingEnabled
          ? "Tenant-controlled sharing is available, but explicit consent-control signals are still limited."
          : "Tenant-controlled consent and sharing controls are not available in the current identity context.",
    },
    {
      key: "export_tenant_controlled",
      status:
        input.exportContext.schemaVersion === "2.0" &&
        input.exportContext.dataScope === "tenant_controlled_export" &&
        input.exportContext.consentRequired
          ? "pass"
          : "missing",
      label: "Tenant-controlled export",
      description:
        "This export is generated on demand in the tenant workspace and requires tenant-controlled consent handling.",
    },
    {
      key: "sensitive_data_minimized",
      status: "pass",
      label: "Sensitive data minimized",
      description:
        "The export excludes raw documents, provider details, signatures, payment methods, tokens, internal identifiers, and raw audit payloads.",
    },
  ];

  const overall = buildOverallReadiness(checks);

  return {
    ...overall,
    checks,
    exportTraceability: {
      exportAvailable: true,
      schemaVersion: "2.0",
      exportStorage: "not_stored",
      outboundTransfer: "none",
    },
    auditTraceability: deriveAuditTraceability(input),
  };
}
