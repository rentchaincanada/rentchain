import type { InstitutionalExportV2 } from "./deriveInstitutionalSchemaV2";

function hasString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

type InstitutionalValidationContext = {
  consentControlsLimited?: boolean;
};

export function validateInstitutionalSchema(
  input: InstitutionalExportV2,
  context: InstitutionalValidationContext = {}
): InstitutionalExportV2["validation"] {
  const warnings: string[] = [];
  const missingRecommendedFields: string[] = [];

  const requiredChecks: Array<[string, boolean]> = [
    ["schema.name", hasString(input.schema?.name)],
    ["schema.version", hasString(input.schema?.version)],
    ["schema.generatedAt", hasString(input.schema?.generatedAt)],
    ["schema.jurisdiction", hasString(input.schema?.jurisdiction)],
    ["schema.dataScope", hasString(input.schema?.dataScope)],
    ["schema.consentRequired", input.schema?.consentRequired === true],
    ["subject.subjectType", hasString(input.subject?.subjectType)],
  ];

  const missingRequiredFields = requiredChecks.filter(([, valid]) => !valid).map(([field]) => field);
  if (missingRequiredFields.length) {
    return {
      status: "invalid",
      warnings: [`Required schema fields are missing or malformed: ${missingRequiredFields.join(", ")}`],
      missingRecommendedFields: [],
    };
  }

  const recommendedChecks: Array<[string, boolean]> = [
    ["subject.identityStatus", hasString(input.subject?.identityStatus)],
    ["subject.verificationLevel", hasString(input.subject?.verificationLevel)],
    ["subject.completenessLevel", hasString(input.subject?.completenessLevel)],
    ["identity.portabilityStatus", hasString(input.identity?.portabilityStatus)],
    ["audit.auditTrailAvailable", typeof input.audit?.auditTrailAvailable === "boolean"],
  ];

  recommendedChecks.forEach(([field, valid]) => {
    if (!valid) {
      missingRecommendedFields.push(field);
      warnings.push(`Recommended field unavailable: ${field}`);
    }
  });

  if (input.identity?.portabilityStatus === "not_ready") {
    warnings.push("Recommended signal limited: portability unavailable");
  }

  if (!input.audit?.auditTrailAvailable || input.audit?.totalIdentityEvents === 0) {
    warnings.push("Recommended signal limited: identity trace unavailable");
  }

  if (
    input.paymentReadiness?.latestPaymentStatus === "not_available" ||
    (!input.paymentReadiness?.rentTermsReady && !input.paymentReadiness?.paymentRailAvailable)
  ) {
    warnings.push("Recommended signal limited: payment readiness unavailable");
  }

  if (context.consentControlsLimited) {
    warnings.push("Recommended signal limited: consent controls limited");
  }

  return {
    status: warnings.length ? "valid_with_warnings" : "valid",
    warnings,
    missingRecommendedFields,
  };
}
