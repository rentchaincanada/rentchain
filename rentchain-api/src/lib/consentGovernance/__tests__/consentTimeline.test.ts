import { describe, expect, it } from "vitest";
import {
  buildConsentAuditRef,
  classifyConsentState,
  CONSENT_TIMELINE_VERSION,
  normalizeConsentTimeline,
  normalizeConsentType,
} from "../consentTimeline";

describe("consent timeline governance", () => {
  it("normalizes consent types and lifecycle states deterministically", () => {
    expect(normalizeConsentType("Screening Consent")).toBe("screening_consent");
    expect(normalizeConsentType("tenant-trust.export consent")).toBe("tenant_trust_export_consent");
    expect(normalizeConsentType("unknown")).toBe("evidence_sharing_consent");

    expect(classifyConsentState({ requestedAt: "2026-05-01T00:00:00.000Z" })).toBe("requested");
    expect(classifyConsentState({ grantedAt: "2026-05-01T00:00:00.000Z" })).toBe("active");
    expect(
      classifyConsentState({
        grantedAt: "2026-05-01T00:00:00.000Z",
        expiresAt: "2026-05-10T00:00:00.000Z",
        generatedAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe("expiring");
    expect(
      classifyConsentState({
        grantedAt: "2026-05-01T00:00:00.000Z",
        expiresAt: "2026-05-01T00:00:00.000Z",
        generatedAt: "2026-05-08T00:00:00.000Z",
      }),
    ).toBe("expired");
    expect(classifyConsentState({ grantedAt: "2026-05-01T00:00:00.000Z", revokedAt: "2026-05-02T00:00:00.000Z" })).toBe("revoked");
    expect(classifyConsentState({ grantedAt: "2026-05-01T00:00:00.000Z", supersededAt: "2026-05-02T00:00:00.000Z" })).toBe("superseded");
    expect(classifyConsentState({ deniedAt: "2026-05-02T00:00:00.000Z" })).toBe("denied");
  });

  it("builds metadata-only consent timelines with scoped lineage references", () => {
    const timeline = normalizeConsentTimeline({
      consentId: "consent-1",
      consentType: "institutional_export_consent",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      requestedAt: "2026-05-01T00:00:00.000Z",
      grantedAt: "2026-05-02T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      grantedBy: "tenant-1",
      requestedBy: "landlord-1",
      authorityScope: {
        scopeType: "export",
        scopeId: "export-1",
        authorityBasis: "server_resolved_tenant_export_scope",
      },
      evidenceRefs: [
        { sourceCollection: "evidencePacks", sourceId: "evidence-1", landlordId: "landlord-1", tenantId: "tenant-1" },
        { sourceCollection: "evidencePacks", sourceId: "other-landlord", landlordId: "landlord-2", tenantId: "tenant-1" },
      ],
      exportRefs: [
        { sourceCollection: "tenantTrustExports", sourceId: "export-1", landlordId: "landlord-1", tenantId: "tenant-1" },
      ],
      reviewRefs: [
        { sourceCollection: "operatorReviewSessions", sourceId: "review-1", landlordId: "landlord-1", tenantId: "tenant-1" },
      ],
      sourceRefs: [
        { sourceCollection: "reportingConsents", sourceId: "consent-1", landlordId: "landlord-1", tenantId: "tenant-1" },
      ],
    });

    expect(timeline).toMatchObject({
      consentTimelineVersion: CONSENT_TIMELINE_VERSION,
      consentId: "consent-1",
      consentType: "institutional_export_consent",
      consentState: "active",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      authorityScope: {
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        scopeType: "export",
        scopeId: "export-1",
        authorityBasis: "server_resolved_tenant_export_scope",
      },
      metadataOnly: true,
      publicSharingEnabled: false,
      externalSubmissionEnabled: false,
      autonomousConsentActionsEnabled: false,
      legalSignatureEngineEnabled: false,
    });
    expect(timeline.evidenceRefs).toHaveLength(1);
    expect(timeline.exportRefs).toHaveLength(1);
    expect(timeline.reviewRefs).toHaveLength(1);
    expect(timeline.sourceRefs).toHaveLength(1);
    expect(timeline.timelineSummary.refCounts).toEqual({ evidence: 1, export: 1, review: 1, source: 1 });
    expect(timeline.evidenceRefs[0]).toEqual(
      expect.objectContaining({
        sourceCollection: "evidencePacks",
        sourceId: "evidence-1",
        internalReference: true,
        tenantVisible: false,
      }),
    );
    expect(JSON.stringify(timeline)).not.toContain("other-landlord");
  });

  it("keeps tenant-visible timelines free of privileged review internals", () => {
    const timeline = normalizeConsentTimeline({
      consentId: "consent-tenant-1",
      consentType: "screening_consent",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      requestedAt: "2026-05-01T00:00:00.000Z",
      tenantVisible: true,
      reviewRefs: [
        { sourceCollection: "operatorReviewSessions", sourceId: "review-1", landlordId: "landlord-1", tenantId: "tenant-1" },
      ],
    });

    expect(timeline.tenantVisible).toBe(true);
    expect(timeline.reviewRefs).toEqual([]);
    expect(timeline.privilegedReviewInternalsIncluded).toBe(false);
    expect(JSON.stringify(timeline)).not.toContain("operatorReviewSessions");
  });

  it("does not copy restricted/raw payload fields into timeline metadata", () => {
    const timeline = normalizeConsentTimeline({
      consentId: "consent-raw-1",
      consentType: "reporting_consent",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      grantedAt: "2026-05-02T00:00:00.000Z",
      sourceRefs: [
        {
          sourceCollection: "reportingConsents",
          sourceId: "consent-raw-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawProviderPayload: { token: "secret-token" },
          rawExportPayload: "raw export",
          stack: "stack trace",
          routeSource: "debug",
        },
      ],
    });

    const serialized = JSON.stringify(timeline);
    expect(timeline.rawProviderPayloadIncluded).toBe(false);
    expect(timeline.rawExportPayloadIncluded).toBe(false);
    expect(timeline.rawEvidencePayloadIncluded).toBe(false);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("raw export");
    expect(serialized).not.toContain("stack trace");
    expect(serialized).not.toContain("routeSource");
  });

  it("builds consent audit refs as internal references only", () => {
    expect(
      buildConsentAuditRef({
        sourceCollection: "reportingConsents",
        sourceId: "consent-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ).toEqual({
      refType: "source",
      sourceCollection: "reportingConsents",
      sourceId: "consent-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true,
      tenantVisible: false,
    });
  });
});
