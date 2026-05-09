import { describe, expect, it } from "vitest";
import { deriveInstitutionExportPackage } from "../deriveInstitutionExportPackage";
import type { PortableAttestation } from "../../portableAttestations/portableAttestationTypes";

function attestation(): PortableAttestation {
  return {
    attestationId: "institution-package-attestation-1",
    attestationType: "property_authority",
    subjectType: "property",
    subjectId: "property:prop-1",
    claimCategory: "property_authority",
    claimLabel: "Property authority metadata present",
    claimDescription: "Property authority metadata is present through an approved workflow.",
    status: "active",
    lifecycleState: "export_ready",
    issuerCategory: "property_registry",
    audience: "lender",
    consentScope: {
      consentId: "consent-1",
      purpose: "lender_review",
      audience: "lender",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      revokedAt: null,
      claimCategories: ["property_authority"],
      attributeScopes: ["status", "timestamps"],
    },
    retentionClass: "portable_metadata",
    evidenceSummary: {
      evidenceCategory: "registry_record",
      sourceSystem: "property_trust",
      sourceCategory: "provider_neutral_property_trust",
      sourceVersion: "property_trust.v1",
      auditEventRef: "event-1",
      rawEvidenceIncluded: false,
    },
    sourceReference: {
      sourceSystem: "property_trust",
      sourceId: "property-trust-1",
      sourceAttestationId: "property-trust-attestation-1",
      sourceVersion: "property_trust.v1",
    },
    confidence: "medium",
    issuedAt: "2026-05-01T00:00:00.000Z",
    effectiveAt: "2026-05-01T00:10:00.000Z",
    expiresAt: "2026-08-01T00:00:00.000Z",
    revokedAt: null,
    supersededAt: null,
    nextReverificationAt: "2026-07-01T00:00:00.000Z",
    jurisdiction: "CA",
    redactionProfile: "strict",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    rawProviderPayloadIncluded: false,
    supportMetadataIncluded: false,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    unsupportedClaim: false,
    supportVisible: true,
    reviewRequired: false,
    nonAuthorityDisclaimers: ["Property authority metadata is not a legal ownership conclusion."],
    internalReferenceId: "internal-reference",
    providerReferenceId: "provider-reference",
  };
}

describe("deriveInstitutionExportPackage", () => {
  it("derives a deterministic preview package with manual-only safeguards", () => {
    const pkg = deriveInstitutionExportPackage({
      packageType: "lender_due_diligence",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", status: "active", unitsCount: 4 }],
      leases: [{ id: "lease-1", status: "active", unitId: "unit-1" }],
      maintenanceRequests: [{ id: "maint-1", status: "open" }],
      decisionItems: [
        {
          id: "decision-1",
          severity: "critical",
          type: "billing",
          workflow: { queue: "delinquency_review" },
        },
      ],
      auditEvents: [{ id: "event-1" }],
    });

    expect(pkg.packageId).toBe("institution_export:lender_due_diligence:landlord-1");
    expect(pkg.audience).toBe("lender");
    expect(pkg.status).toBe("preview_ready");
    expect(pkg.manualOnly).toBe(true);
    expect(pkg.externalSubmissionEnabled).toBe(false);
    expect(pkg.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionKey: "property_summary", status: "included", recordsCount: 1 }),
        expect.objectContaining({ sectionKey: "lease_summary", status: "included", recordsCount: 1 }),
        expect.objectContaining({ sectionKey: "delinquency_summary", status: "included", recordsCount: 1 }),
      ])
    );
    expect(pkg.payloadPreview).toEqual(
      expect.objectContaining({
        propertySummary: expect.objectContaining({ propertyCount: 1, unitCount: 4 }),
        delinquencySummary: expect.objectContaining({ decisionsCount: 1, criticalCount: 1 }),
      })
    );
  });

  it("blocks previews when landlord or property context is missing", () => {
    const pkg = deriveInstitutionExportPackage({
      packageType: "auditor_review",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [],
      leases: [],
    });

    expect(pkg.status).toBe("blocked");
    expect(pkg.packageId).toBe("institution_export:auditor_review:missing_landlord");
    expect(pkg.blockedReasons).toEqual(
      expect.arrayContaining([
        "Landlord context is required before an institution export preview can be prepared.",
        "At least one landlord-scoped property is required for institution export preview.",
      ])
    );
    expect(pkg.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionKey: "property_summary", status: "blocked" }),
        expect.objectContaining({ sectionKey: "lease_summary", status: "unavailable" }),
      ])
    );
  });

  it("lists redactions and excludes sensitive raw payload categories from the preview", () => {
    const pkg = deriveInstitutionExportPackage({
      packageType: "government_program_review",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1" }],
      leases: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          ssn: "123-45-6789",
          creditReport: { score: 700 },
          bankAccountNumber: "000123",
        } as any,
      ],
    });

    expect(pkg.redactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldCategory: "tenant_contact_details" }),
        expect.objectContaining({ fieldCategory: "screening_payloads" }),
        expect.objectContaining({ fieldCategory: "payment_account_details" }),
      ])
    );
    expect(JSON.stringify(pkg.payloadPreview)).not.toMatch(/123-45-6789|creditReport|000123|tenant-1/);
  });

  it("optionally attaches policy-gated portable trust exports without changing route adoption", () => {
    const pkg = deriveInstitutionExportPackage({
      packageType: "lender_due_diligence",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", status: "active", unitsCount: 1 }],
      portableAttestations: [attestation()],
    });

    expect(pkg.trustExport).toEqual(
      expect.objectContaining({
        audience: "lender",
        purpose: "lender_review",
        status: "export_ready",
        metadataOnly: true,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    expect(pkg.sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ sectionKey: "portable_trust_summary", status: "included", recordsCount: 1 })])
    );
    expect(pkg.payloadPreview.portableTrustSummary).toEqual(
      expect.objectContaining({
        exportableAttestationCount: 1,
        policyDecisionCount: 1,
        metadataOnly: true,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    expect(JSON.stringify(pkg.trustExport)).not.toContain("provider-reference");
    expect(JSON.stringify(pkg.trustExport)).not.toContain("internal-reference");
  });
});
