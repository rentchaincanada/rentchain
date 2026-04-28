import { describe, expect, it } from "vitest";
import { deriveComplianceReadiness } from "../deriveComplianceReadiness";

describe("deriveComplianceReadiness", () => {
  it("derives ready when validation, traceability, and consent signals are present", () => {
    const result = deriveComplianceReadiness({
      validation: {
        status: "valid",
        warnings: [],
        missingRecommendedFields: [],
      },
      identityTimeline: {
        totalEvents: 3,
        recentActivityAvailable: true,
      },
      consentControls: {
        sharingEnabled: true,
        verificationRequestsAvailable: true,
        approvedScopeCount: 1,
      },
      exportContext: {
        schemaVersion: "2.0",
        dataScope: "tenant_controlled_export",
        consentRequired: true,
      },
    });

    expect(result.readinessStatus).toBe("ready");
    expect(result.exportTraceability).toEqual({
      exportAvailable: true,
      schemaVersion: "2.0",
      exportStorage: "not_stored",
      outboundTransfer: "none",
    });
  });

  it("derives partial when schema is usable but traceability or consent signals are limited", () => {
    const result = deriveComplianceReadiness({
      validation: {
        status: "valid_with_warnings",
        warnings: ["Recommended field unavailable"],
        missingRecommendedFields: ["identity.portabilityStatus"],
      },
      identityTimeline: {
        totalEvents: 0,
        recentActivityAvailable: false,
      },
      consentControls: {
        sharingEnabled: true,
        verificationRequestsAvailable: false,
        approvedScopeCount: 0,
      },
      exportContext: {
        schemaVersion: "2.0",
        dataScope: "tenant_controlled_export",
        consentRequired: true,
      },
    });

    expect(result.readinessStatus).toBe("partial");
    expect(result.checks.find((check) => check.key === "identity_trace_available")?.status).toBe("warning");
    expect(result.checks.find((check) => check.key === "consent_controls_available")?.status).toBe("warning");
  });

  it("derives not_ready when schema validation is invalid", () => {
    const result = deriveComplianceReadiness({
      validation: {
        status: "invalid",
        warnings: ["Required schema fields are missing"],
        missingRecommendedFields: [],
      },
      identityTimeline: {
        totalEvents: 2,
        recentActivityAvailable: true,
      },
      consentControls: {
        sharingEnabled: false,
        verificationRequestsAvailable: false,
        approvedScopeCount: 0,
      },
      exportContext: {
        schemaVersion: "2.0",
        dataScope: "tenant_controlled_export",
        consentRequired: true,
      },
    });

    expect(result.readinessStatus).toBe("not_ready");
    expect(result.checks.find((check) => check.key === "schema_validated")?.status).toBe("missing");
    expect(JSON.stringify(result)).not.toContain("tokenHash");
    expect(JSON.stringify(result)).not.toContain("documentUrl");
    expect(JSON.stringify(result)).not.toContain("paymentMethod");
  });
});
