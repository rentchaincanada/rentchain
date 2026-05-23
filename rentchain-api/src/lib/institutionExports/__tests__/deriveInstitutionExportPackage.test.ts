import { describe, expect, it } from "vitest";
import { deriveInstitutionExportPackage } from "../deriveInstitutionExportPackage";
import type { PortableAttestation } from "../../portableAttestations/portableAttestationTypes";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";

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
    expect(pkg.exportGeneratedAt).toBe("2026-05-05T12:00:00.000Z");
    expect(pkg.exportVersion).toBe("institution_export_allowlist_v1");
    expect(pkg.exportScope).toBe("landlord_portfolio_preview");
    expect(pkg.sensitivityClass).toBe("restricted");
    expect(pkg.authorityBasis).toBe("landlord_scoped_preview");
    expect(pkg.manualOnly).toBe(true);
    expect(pkg.externalSubmissionEnabled).toBe(false);
    expect(pkg.exportProfile).toEqual(
      expect.objectContaining({
        exportProfile: "institutional_export_preview",
        exportVersion: "institution_export_allowlist_v1",
        audienceCategory: "lender",
        exportScope: "landlord_portfolio_preview",
        sensitivityClass: "restricted",
        authorityBasis: "landlord_scoped_preview",
        projectionPolicy: "Allowlisted aggregate preview only; do not include raw source records.",
        retentionPolicy: "Preview metadata only; retention policy must be approved before external sharing.",
        auditExpectation: "Manual review and audit event linkage required before institutional export release.",
      }),
    );
    expect(pkg.exportProfile.allowedFieldGroups).toEqual(
      expect.arrayContaining([
        "aggregate_counts",
        "status_summaries",
        "occupancy_summaries",
        "delinquency_summaries",
        "redaction_categories",
      ]),
    );
    expect(pkg.exportProfile.excludedFieldGroups).toEqual(
      expect.arrayContaining([
        "raw_provider_payloads",
        "raw_screening_reports",
        "raw_csv_values",
        "payment_account_details",
        "private_message_contents",
        "debug_payloads",
      ]),
    );
    expect(pkg.sourceCollections).toEqual(
      expect.arrayContaining(["auditEvents", "decisionItems", "leases", "maintenanceRequests", "properties"]),
    );
    expect(pkg.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceCollection: "properties", sourceId: "prop-1" }),
        expect.objectContaining({ sourceCollection: "leases", sourceId: "lease-1" }),
        expect.objectContaining({ sourceCollection: "maintenanceRequests", sourceId: "maint-1" }),
        expect.objectContaining({ sourceCollection: "decisionItems", sourceId: "decision-1" }),
        expect.objectContaining({ sourceCollection: "auditEvents", sourceId: "event-1" }),
      ]),
    );
    expect(pkg.redactionSummary).toEqual(
      expect.objectContaining({
        redactionPolicy:
          "Exclude raw/provider/payment credential/debug/private-message fields; include redaction categories only.",
        redactionCount: 5,
        redactedFieldGroups: [
          "identity_documents",
          "payment_account_details",
          "private_message_contents",
          "screening_payloads",
          "tenant_contact_details",
        ],
      }),
    );
    expect(pkg.lineageSummary).toEqual(
      expect.objectContaining({
        sourceReferenceCount: 5,
        sourceCollections: expect.arrayContaining([
          "auditEvents",
          "decisionItems",
          "leases",
          "maintenanceRequests",
          "properties",
        ]),
        lineagePolicy: "Each represented source collection declares deterministic source IDs or count-only lineage.",
      }),
    );
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

  it("derives deterministic allowlist metadata and lineage ordering", () => {
    const input = {
      packageType: "auditor_review" as const,
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", status: "active", unitsCount: 1 }],
      leases: [{ id: "lease-1", status: "active", unitId: "unit-1" }],
      units: [{ id: "unit-1", status: "occupied", leaseId: "lease-1" }],
      decisionItems: [{ id: "decision-1", severity: "warning", workflow: { queue: "review" } }],
      auditEvents: [{ id: "event-1" }],
    };
    const first = deriveInstitutionExportPackage(input);
    const second = deriveInstitutionExportPackage(input);

    expect(first.sourceRefs).toEqual(second.sourceRefs);
    expect(first.sourceRefs.map((ref) => `${ref.sourceCollection}:${ref.sourceId}`)).toEqual(
      [...first.sourceRefs.map((ref) => `${ref.sourceCollection}:${ref.sourceId}`)].sort(),
    );
    expect(first.exportProfile.allowedCollections).toEqual(first.sourceCollections);
    expect(first.projectionPolicy).toBe("Allowlisted aggregate preview only; do not include raw source records.");
    expect(first.payloadPreview).toEqual(second.payloadPreview);
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
      properties: [{ id: "prop-1", rawPayload: { routeSource: "internal-router" } } as any],
      leases: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          ssn: "123-45-6789",
          creditReport: { score: 700 },
          bankAccountNumber: "000123",
          rawCsv: "raw tenant export csv",
        } as any,
      ],
      maintenanceRequests: [
        {
          id: "maint-1",
          providerPayload: { rawReport: "raw provider payload" },
        } as any,
      ],
      decisionItems: [
        {
          id: "decision-1",
          severity: "critical",
          type: "billing",
          workflow: { queue: "delinquency_review" },
          internalDebug: "debug payload",
        } as any,
      ],
      auditEvents: [
        {
          id: "event-1",
          stack: "private stack trace",
          webhookSecret: "whsec_secret",
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
    expectNoRestrictedProjectionFields(pkg.payloadPreview);
    expectNoRestrictedProjectionFields(pkg.exportProfile);
    expectNoRestrictedProjectionFields(pkg.redactionSummary);
    expectNoRestrictedProjectionFields(pkg.lineageSummary);
    expectPayloadDoesNotContainValues(pkg.payloadPreview, [
      "123-45-6789",
      "creditReport",
      "000123",
      "tenant-1",
      "raw tenant export csv",
      "raw provider payload",
      "debug payload",
      "private stack trace",
      "whsec_secret",
      "internal-router",
    ]);
    expectPayloadDoesNotContainValues(
      {
        exportProfile: pkg.exportProfile,
        sourceRefs: pkg.sourceRefs,
        redactionSummary: pkg.redactionSummary,
        lineageSummary: pkg.lineageSummary,
      },
      [
        "123-45-6789",
        "creditReport",
        "000123",
        "tenant-1",
        "raw tenant export csv",
        "raw provider payload",
        "debug payload",
        "private stack trace",
        "whsec_secret",
        "internal-router",
      ],
    );
  });

  it("keeps impersonation/support metadata out of user-safe institution export previews", () => {
    const pkg = deriveInstitutionExportPackage({
      packageType: "lender_due_diligence",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", status: "active", unitsCount: 4 }],
      auditEvents: [
        {
          id: "impersonation-event-1",
          type: "impersonation.started",
          realActorId: "admin-1",
          realActorRole: "admin",
          effectiveActorId: "tenant-1",
          effectiveActorRole: "tenant",
          impersonationSessionId: "session-1",
          impersonationReason: "incident_review",
          impersonationStartedAt: "2026-05-22T20:00:00.000Z",
          supportProjectionSafe: true,
          tenantVisible: false,
          visibilityClass: "admin_support_internal",
          policyDecision: "allowed",
          sourceActionFamily: "admin_support_impersonation",
          actorChain: {
            realActorId: "admin-1",
            effectiveActorId: "tenant-1",
          },
          debugPayload: { stack: "private stack trace" },
          rawProviderPayload: { token: "secret-token" },
        } as any,
      ],
    });

    expect(pkg.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceCollection: "auditEvents", sourceId: "impersonation-event-1" }),
      ]),
    );
    expect(pkg.payloadPreview).toEqual(
      expect.objectContaining({
        auditEventSummary: { total: 1 },
      }),
    );
    expectPayloadDoesNotContainValues(pkg, [
      "realActorId",
      "realActorRole",
      "effectiveActorId",
      "effectiveActorRole",
      "impersonationSessionId",
      "impersonationReason",
      "impersonationStartedAt",
      "impersonationActive",
      "supportProjectionSafe",
      "tenantVisible",
      "visibilityClass",
      "policyDecision",
      "sourceActionFamily",
      "actorChain",
      "admin-1",
      "tenant-1",
      "session-1",
      "incident_review",
      "private stack trace",
      "secret-token",
    ]);
    expectNoRestrictedProjectionFields(pkg.payloadPreview);
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
    expect(pkg.sourceCollections).toEqual(expect.arrayContaining(["portableAttestations", "properties"]));
    expect(pkg.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceCollection: "portableAttestations",
          sourceId: "institution-package-attestation-1",
        }),
      ]),
    );
  });
});
