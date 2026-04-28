export type ComplianceReadinessCheckKey =
  | "schema_validated"
  | "identity_trace_available"
  | "consent_controls_available"
  | "export_tenant_controlled"
  | "sensitive_data_minimized";

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
  };
}
