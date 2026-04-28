import { describe, expect, it } from "vitest";
import { validateInstitutionalSchema } from "../validateInstitutionalSchema";
import type { InstitutionalExportV2 } from "../deriveInstitutionalSchemaV2";

function buildValidExport(): InstitutionalExportV2 {
  return {
    schema: {
      name: "rentchain.institutional_identity_package",
      version: "2.0",
      generatedAt: "2026-04-27T00:00:00.000Z",
      jurisdiction: "CA",
      dataScope: "tenant_controlled_export",
      consentRequired: true,
    },
    subject: {
      subjectType: "tenant",
      identityStatus: "ready",
      verificationLevel: "partial",
      completenessLevel: "high",
    },
    identity: {
      portabilityStatus: "limited",
      identityReadiness: "ready",
      credibilityReadiness: "high",
    },
    rentalHistory: {
      activeLeaseAvailable: true,
      leaseExecutionStatus: "executed",
      leaseSummaryAvailable: true,
    },
    paymentReadiness: {
      rentTermsReady: true,
      paymentRailAvailable: true,
      latestPaymentStatus: "paid",
    },
    audit: {
      auditTrailAvailable: true,
      totalIdentityEvents: 3,
      recentActivityAvailable: true,
    },
    validation: {
      status: "valid",
      warnings: [],
      missingRecommendedFields: [],
    },
    extensions: {
      reserved: {},
    },
  };
}

describe("validateInstitutionalSchema", () => {
  it("returns valid when required and recommended fields are present", () => {
    expect(validateInstitutionalSchema(buildValidExport())).toEqual({
      status: "valid",
      warnings: [],
      missingRecommendedFields: [],
    });
  });

  it("returns valid_with_warnings when recommended fields are missing", () => {
    const payload = buildValidExport();
    (payload.identity as any).portabilityStatus = "";
    const result = validateInstitutionalSchema(payload);
    expect(result.status).toBe("valid_with_warnings");
    expect(result.missingRecommendedFields).toContain("identity.portabilityStatus");
  });

  it("adds safe summary warnings for portability, trace, payment readiness, and consent limits", () => {
    const payload = buildValidExport();
    payload.identity.portabilityStatus = "not_ready";
    payload.audit.auditTrailAvailable = false;
    payload.audit.totalIdentityEvents = 0;
    payload.paymentReadiness = {
      rentTermsReady: false,
      paymentRailAvailable: false,
      latestPaymentStatus: "not_available",
    };

    const result = validateInstitutionalSchema(payload, {
      consentControlsLimited: true,
    });

    expect(result.status).toBe("valid_with_warnings");
    expect(result.warnings).toContain("Recommended signal limited: portability unavailable");
    expect(result.warnings).toContain("Recommended signal limited: identity trace unavailable");
    expect(result.warnings).toContain("Recommended signal limited: payment readiness unavailable");
    expect(result.warnings).toContain("Recommended signal limited: consent controls limited");
    expect(JSON.stringify(result)).not.toContain("tokenHash");
    expect(JSON.stringify(result)).not.toContain("requestId");
    expect(JSON.stringify(result)).not.toContain("occurredAt");
  });

  it("returns invalid when required fields are malformed", () => {
    const payload = buildValidExport();
    (payload.schema as any).name = "";
    const result = validateInstitutionalSchema(payload);
    expect(result.status).toBe("invalid");
    expect(result.warnings[0]).toContain("schema.name");
  });
});
