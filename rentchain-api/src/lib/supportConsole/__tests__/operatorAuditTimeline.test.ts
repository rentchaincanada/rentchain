import { describe, expect, it } from "vitest";
import { buildOperatorAuditTimeline } from "../operatorAuditTimeline";

describe("buildOperatorAuditTimeline", () => {
  it("reconstructs support-safe lifecycle, session, supersession, and operator events", () => {
    const timeline = buildOperatorAuditTimeline({
      grantId: "grant-1",
      grant: {
        audience: "insurer",
        purpose: "insurance_review",
        package: {
          exportId: "package-1",
          status: "blocked",
          generatedAt: "2026-05-01T00:00:00.000Z",
          lifecycleControl: {
            schemaVersion: "institutional_trust_export_lifecycle_control.v1",
            state: "reverification_required",
            reasons: ["reverification_required"],
            active: false,
            shareable: false,
            evaluatedAt: "2026-05-01T00:00:00.000Z",
            metadataOnly: true,
            publicAccessEnabled: false,
            externalSubmissionEnabled: false,
          },
        },
      },
      diagnostic: {
        schemaVersion: "support_institution_access_diagnostics.v1",
        grantId: "grant-1",
        lifecycle: "active",
        audience: "insurer",
        purpose: "insurance_review",
        recipient: {
          redactedEmail: "re***@example.com",
          organizationName: "Example Insurance",
          authenticationRequirement: "recipient_email_session_required",
        },
        tenant: { redactedTenantId: "***nt-1" },
        consent: {
          granted: true,
          consentVersion: "tenant_institution_access_consent.v1",
          grantedAt: "2026-05-01T00:00:00.000Z",
          expiresAt: "2026-06-01T00:00:00.000Z",
          revokedAt: null,
        },
        access: {
          recipientAuthenticationRequired: true,
          sessionBound: true,
          publicAccessEnabled: false,
          publicProfileEnabled: false,
          externalSubmissionEnabled: false,
          downloadEnabled: false,
        },
        package: { status: "blocked", blockedReasonCount: 1, exportSummaryCount: 0 },
        audit: {
          totalEvents: 2,
          openedReviewCount: 0,
          blockedReviewCount: 1,
          revokedAccessCount: 1,
          expiredAccessCount: 0,
          sessionStartedCount: 1,
          sessionExpiredCount: 0,
          lastActivityAt: "2026-05-03T00:00:00.000Z",
          lastOpenedAt: null,
          lastBlockedAt: "2026-05-02T00:00:00.000Z",
          lastOutcome: "revoked",
          lastReason: "access_revoked",
          reasonCategories: ["access_revoked", "recipient_email_mismatch"],
        },
        payloadSafety: {
          metadataOnly: true,
          supportSafe: true,
          trustPayloadIncluded: false,
          portableAttestationContentsIncluded: false,
          rawProviderPayloadIncluded: false,
          rawIdentityPayloadIncluded: false,
          rawPropertyPayloadIncluded: false,
          supportMetadataIncluded: false,
          unsafePortablePayloadDetected: false,
        },
        timeline: [
          {
            eventType: "recipient_review_session_started",
            occurredAt: "2026-05-01T00:30:00.000Z",
            actorType: "recipient",
            outcome: "session_started",
            status: "active",
            reason: "session_started",
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              trustPayloadIncluded: false,
              rawProviderPayloadIncluded: false,
              supportMetadataIncluded: false,
            },
          },
          {
            eventType: "recipient_trust_review_blocked",
            occurredAt: "2026-05-02T00:00:00.000Z",
            actorType: "recipient",
            outcome: "blocked",
            status: "recipient_mismatch",
            reason: "recipient_email_mismatch",
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              trustPayloadIncluded: false,
              rawProviderPayloadIncluded: false,
              supportMetadataIncluded: false,
            },
          },
          {
            eventType: "tenant_institution_access_revoked",
            occurredAt: "2026-05-03T00:00:00.000Z",
            actorType: "tenant",
            outcome: "revoked",
            status: "revoked",
            reason: "access_revoked",
            metadataOnly: true,
            visibility: {
              supportVisible: true,
              trustPayloadIncluded: false,
              rawProviderPayloadIncluded: false,
              supportMetadataIncluded: false,
            },
          },
        ],
      },
      tenantTrustExports: [
        {
          exportId: "export-1",
          lifecycle: "superseded",
          lifecycleControl: { state: "superseded", active: false },
          lifecycleEvents: [
            {
              eventType: "trust_export_superseded",
              occurredAt: "2026-05-02T12:00:00.000Z",
              actorType: "system",
              reason: "export_superseded",
              metadataOnly: true,
            },
          ],
        },
      ],
      canonicalEvents: [
        {
          id: "operator-1",
          version: "v1",
          type: "system.institution_access_diagnostics_opened",
          domain: "system",
          action: "institution_access_diagnostics_opened",
          status: "completed",
          actor: { type: "admin", id: "operator-1", role: "admin" },
          resource: { type: "tenant_institution_access_grant", id: "grant-1" },
          occurredAt: "2026-05-04T00:00:00.000Z",
          recordedAt: "2026-05-04T00:00:00.000Z",
          visibility: "system",
          summary: "Institution access diagnostics opened with redacted metadata-only view.",
          metadata: {
            metadataOnly: true,
            redactionApplied: true,
            retentionCategory: "support_diagnostics",
          },
        },
      ],
    });

    expect(timeline).toEqual(
      expect.objectContaining({
        schemaVersion: "operator_audit_timeline.v1",
        metadataOnly: true,
        supportSafe: true,
        eventCount: 6,
        lifecycleTransitionCount: 1,
        revocationCount: 1,
        supersessionCount: 1,
        sessionEventCount: 1,
        operatorInteractionCount: 1,
      })
    );
    expect(timeline.events[0]).toEqual(
      expect.objectContaining({
        source: "operator_interaction",
        category: "operator_access",
        operator: expect.objectContaining({
          redactedOperatorId: "***or-1",
          role: "admin",
        }),
      })
    );
    expect(timeline.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "tenant_institution_access_revoked",
        "trust_export_superseded",
        "recipient_review_session_started",
        "institutional_trust_export_lifecycle_evaluated",
      ])
    );
    expect(JSON.stringify(timeline)).not.toContain("reviewer@example.com");
    expect(JSON.stringify(timeline)).not.toContain("includedClaims");
    expect(JSON.stringify(timeline)).not.toContain("exportSummaries");
    expect(timeline.payloadSafety).toEqual({
      trustPayloadIncluded: false,
      portableAttestationContentsIncluded: false,
      rawProviderPayloadIncluded: false,
      rawIdentityPayloadIncluded: false,
      rawPropertyPayloadIncluded: false,
      supportMetadataIncluded: false,
      downloadableArtifactIncluded: false,
      publicAccessEnabled: false,
    });
  });
});
