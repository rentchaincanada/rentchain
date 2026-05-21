import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  SECURITY_INCIDENT_GOVERNANCE_VERSION,
  buildSecurityIncidentReference,
  classifySecurityIncidentSeverity,
  normalizeSecurityIncidentAffectedResources,
  normalizeSecurityIncidentCategory,
  normalizeSecurityIncidentEvidenceLinks,
  normalizeSecurityIncidentResponseState,
  normalizeSecurityIncidentSeverity,
} from "../securityIncidentGovernance";

describe("securityIncidentGovernance", () => {
  it("normalizes categories, severities, and manual response states deterministically", () => {
    expect(normalizeSecurityIncidentCategory("Credential Secret")).toBe("credential_secret");
    expect(normalizeSecurityIncidentCategory("unknown-new-category")).toBe("suspicious_activity");
    expect(normalizeSecurityIncidentSeverity("Critical")).toBe("critical");
    expect(normalizeSecurityIncidentSeverity("unknown")).toBe("medium");
    expect(normalizeSecurityIncidentResponseState("Investigating")).toBe("investigating");
    expect(normalizeSecurityIncidentResponseState("auto_remediated")).toBe("observed");
  });

  it("classifies severity without enabling automated remediation", () => {
    expect(classifySecurityIncidentSeverity({ category: "credential_secret", confirmedExposure: true })).toBe(
      "critical"
    );
    expect(classifySecurityIncidentSeverity({ category: "api_abuse", productionImpact: true })).toBe("high");
    expect(classifySecurityIncidentSeverity({ category: "document_upload" })).toBe("medium");
    expect(classifySecurityIncidentSeverity({ category: "infrastructure_deployment" })).toBe("low");
  });

  it("filters affected resources to the requested landlord and tenant scope", () => {
    const refs = normalizeSecurityIncidentAffectedResources(
      [
        { resourceType: "lease", resourceId: "lease-1", label: "North Towers lease", landlordId: "landlord-1", tenantId: "tenant-1" },
        { resourceType: "lease", resourceId: "lease-2", label: "Wrong landlord", landlordId: "landlord-2", tenantId: "tenant-1" },
        { resourceType: "lease", resourceId: "lease-3", label: "Wrong tenant", landlordId: "landlord-1", tenantId: "tenant-2" },
        { resourceType: "unknown", resourceId: "unknown-1", label: "Unsupported resource", landlordId: "landlord-1" },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(refs).toEqual([
      {
        resourceType: "lease",
        resourceId: "lease-1",
        label: "North Towers lease",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        internalReference: true,
      },
    ]);
  });

  it("keeps evidence links as lineage references without raw payload duplication", () => {
    const refs = normalizeSecurityIncidentEvidenceLinks([
      {
        evidencePackId: "evidence-1",
        label: "Credential exposure review evidence",
        sourceCollection: "canonicalEvents",
        sourceId: "event-1",
        sensitivityClass: "restricted",
        providerPayload: "raw provider dump",
        rawCsv: "raw csv data",
        token: "secret-token",
      },
    ]);

    expect(refs).toEqual([
      {
        evidenceId: "evidence-1",
        label: "Credential exposure review evidence",
        sourceCollection: "canonicalEvents",
        sourceId: "event-1",
        sensitivityClass: "restricted",
        internalReference: true,
      },
    ]);
    expectNoRestrictedProjectionFields(refs);
    expectPayloadDoesNotContainValues(refs, ["raw provider dump", "raw csv data", "secret-token"]);
  });

  it("builds metadata-only manual security incident references", () => {
    const incident = buildSecurityIncidentReference({
      category: "credential_secret",
      confirmedExposure: true,
      responseState: "investigating",
      title: "API key exposure review",
      summary: "Potential exposed provider key requires manual investigation.",
      detectedAt: "2026-05-21T10:00:00.000Z",
      updatedAt: "2026-05-21T10:05:00.000Z",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      affectedResources: [
        {
          resourceType: "credential",
          resourceId: "stripe-webhook-secret",
          label: "Stripe webhook secret rotation review",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          webhookSecret: "whsec_sensitive",
          stack: "private stack trace",
        },
      ],
      evidenceLinks: [
        {
          evidenceId: "evidence-1",
          label: "Secret exposure evidence",
          sourceCollection: "securityTelemetry",
          sourceId: "telemetry-1",
          sensitivityClass: "critical",
          apiKey: "sk_live_sensitive",
        },
      ],
    });

    expect(incident).toEqual(
      expect.objectContaining({
        incidentGovernanceVersion: SECURITY_INCIDENT_GOVERNANCE_VERSION,
        incidentId: "security_incident:credential_secret:2026-05-21t10:00:00.000z",
        category: "credential_secret",
        severity: "critical",
        responseState: "investigating",
        visibilityClass: "admin_support",
        sensitivityClass: "critical",
        manualOnly: true,
        autonomousRemediationEnabled: false,
        tokenRevocationAutomated: false,
        credentialRotationAutomated: false,
        accountLockAutomated: false,
        tenantVisible: false,
        externalAlertingEnabled: false,
      })
    );
    expect(incident.affectedResources).toEqual([
      expect.objectContaining({
        resourceType: "credential",
        resourceId: "stripe-webhook-secret",
        internalReference: true,
      }),
    ]);
    expect(incident.evidenceLinks).toEqual([
      expect.objectContaining({
        evidenceId: "evidence-1",
        sourceCollection: "securityTelemetry",
        sourceId: "telemetry-1",
        internalReference: true,
      }),
    ]);
    expectNoRestrictedProjectionFields(incident);
    expectPayloadDoesNotContainValues(incident, [
      "whsec_sensitive",
      "private stack trace",
      "sk_live_sensitive",
    ]);
  });

  it("does not imply tenant-visible incident internals or autonomous response controls", () => {
    const incident = buildSecurityIncidentReference({
      category: "tenant_data_exposure",
      tenantDataInvolved: true,
      affectedResources: [{ resourceType: "tenant", resourceId: "tenant-1", label: "Tenant data review" }],
    });

    expect(incident.tenantVisible).toBe(false);
    expect(incident.manualOnly).toBe(true);
    expect(incident.autonomousRemediationEnabled).toBe(false);
    expect(incident.accountLockAutomated).toBe(false);
    expect(incident.tokenRevocationAutomated).toBe(false);
    expect(incident.credentialRotationAutomated).toBe(false);
  });
});
