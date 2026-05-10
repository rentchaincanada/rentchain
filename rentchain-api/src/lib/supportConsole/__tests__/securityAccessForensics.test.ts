import { describe, expect, it } from "vitest";
import { buildSecurityAccessForensics } from "../securityAccessForensics";
import type { OperatorAuditTimelineSummary } from "../operatorAuditTimeline";
import type { SupportInstitutionAccessDiagnosticSummary } from "../../../services/tenantPortal/tenantInstitutionAccessService";

const visibility = {
  supportVisible: true,
  tenantVisible: false,
  recipientVisible: false,
  portableVisible: false,
  trustPayloadIncluded: false,
  providerPayloadIncluded: false,
  rawIdentityPayloadIncluded: false,
  rawPropertyPayloadIncluded: false,
  supportMetadataIncluded: false,
  downloadEnabled: false,
  publicAccessEnabled: false,
} as const;

function diagnostic(): SupportInstitutionAccessDiagnosticSummary {
  return {
    schemaVersion: "support_institution_access_diagnostics.v1",
    grantId: "grant-sensitive-1",
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
    package: {
      status: "export_ready",
      blockedReasonCount: 0,
      exportSummaryCount: 1,
    },
    audit: {
      totalEvents: 5,
      openedReviewCount: 0,
      blockedReviewCount: 3,
      revokedAccessCount: 1,
      expiredAccessCount: 1,
      sessionStartedCount: 1,
      sessionExpiredCount: 1,
      lastActivityAt: "2026-05-06T00:00:00.000Z",
      lastOpenedAt: null,
      lastBlockedAt: "2026-05-06T00:00:00.000Z",
      lastOutcome: "blocked",
      lastReason: "recipient_session_stale",
      reasonCategories: [
        "recipient_email_mismatch",
        "access_revoked",
        "access_expired",
        "recipient_session_replay_blocked",
        "recipient_session_stale",
      ],
    },
    securityTelemetry: {
      schemaVersion: "support_safe_security_session_telemetry.v1",
      internalOnly: true,
      metadataOnly: true,
      eventCount: 6,
      blockedAttemptCount: 5,
      wrongRecipientAttemptCount: 2,
      revokedAttemptCount: 1,
      expiredAttemptCount: 1,
      replayBlockedCount: 1,
      staleSessionCount: 1,
      uniqueIpHashCount: 2,
      userAgentFamilies: ["chrome", "safari"],
      lastSignal: "stale_session_attempt",
      lastRecordedAt: "2026-05-06T00:00:00.000Z",
      signals: [
        "wrong_recipient_attempt",
        "revoked_access_attempt",
        "expired_access_attempt",
        "replay_blocked_attempt",
        "stale_session_attempt",
      ],
      retention: {
        classification: "security_session_internal",
        nonPortable: true,
        nonExportable: true,
      },
      redaction: {
        ipAddressMode: "hash_only",
        userAgentMode: "family_and_hash",
        rawIpVisible: false,
        rawUserAgentVisible: false,
        preciseGeolocationIncluded: false,
        deviceFingerprintingIncluded: false,
        behavioralProfileIncluded: false,
        riskScoreIncluded: false,
      },
      visibility: {
        supportSafe: true,
        operatorVisible: true,
        tenantVisible: false,
        recipientVisible: false,
        portableVisible: false,
        publicVisible: false,
        trustPayloadIncluded: false,
        providerPayloadIncluded: false,
        rawIdentityPayloadIncluded: false,
        rawPropertyPayloadIncluded: false,
      },
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
        eventType: "recipient_trust_review_blocked",
        occurredAt: "2026-05-02T00:00:00.000Z",
        actorType: "recipient",
        metadataOnly: true,
        outcome: "blocked",
        status: "recipient_mismatch",
        reason: "recipient_email_mismatch",
      },
      {
        eventType: "recipient_trust_review_revoked",
        occurredAt: "2026-05-03T00:00:00.000Z",
        actorType: "recipient",
        metadataOnly: true,
        outcome: "blocked",
        status: "revoked",
        reason: "access_revoked",
      },
      {
        eventType: "recipient_trust_review_expired",
        occurredAt: "2026-05-04T00:00:00.000Z",
        actorType: "recipient",
        metadataOnly: true,
        outcome: "blocked",
        status: "expired",
        reason: "access_expired",
      },
      {
        eventType: "institution_review_session_replay_blocked",
        occurredAt: "2026-05-05T00:00:00.000Z",
        actorType: "recipient",
        metadataOnly: true,
        outcome: "blocked",
        status: "blocked",
        reason: "recipient_session_replay_blocked",
      },
      {
        eventType: "recipient_review_session_blocked",
        occurredAt: "2026-05-06T00:00:00.000Z",
        actorType: "recipient",
        metadataOnly: true,
        outcome: "blocked",
        status: "blocked",
        reason: "recipient_session_stale",
      },
    ],
  };
}

function operatorTimeline(): OperatorAuditTimelineSummary {
  return {
    schemaVersion: "operator_audit_timeline.v1",
    metadataOnly: true,
    supportSafe: true,
    eventCount: 2,
    lifecycleTransitionCount: 1,
    revocationCount: 0,
    expirationCount: 0,
    supersessionCount: 1,
    policyDeniedCount: 0,
    sessionEventCount: 0,
    operatorInteractionCount: 1,
    firstEventAt: "2026-05-07T00:00:00.000Z",
    lastEventAt: "2026-05-08T00:00:00.000Z",
    events: [
      {
        schemaVersion: "operator_audit_timeline_event.v1",
        eventId: "operator-event-1",
        source: "operator_interaction",
        category: "operator_access",
        eventType: "system.institution_access_diagnostics_opened",
        occurredAt: "2026-05-08T00:00:00.000Z",
        actorType: "operator",
        status: "completed",
        outcome: "completed",
        reason: "support_diagnostics",
        lifecycleState: null,
        audience: null,
        purpose: null,
        resource: {
          type: "tenant_institution_access_grant",
          id: "grant-sensitive-1",
          redactedId: "***ve-1",
        },
        operator: {
          redactedOperatorId: "***or-1",
          role: "admin",
        },
        metadataOnly: true,
        visibility,
      },
      {
        schemaVersion: "operator_audit_timeline_event.v1",
        eventId: "export-event-1",
        source: "tenant_trust_export",
        category: "trust_export_lifecycle",
        eventType: "trust_export_superseded",
        occurredAt: "2026-05-07T00:00:00.000Z",
        actorType: "system",
        status: "superseded",
        outcome: "inactive",
        reason: "export_superseded",
        lifecycleState: "superseded",
        audience: "insurer",
        purpose: "insurance_review",
        resource: {
          type: "tenant_trust_export",
          id: "export-sensitive-1",
          redactedId: "***ve-1",
        },
        metadataOnly: true,
        visibility,
      },
    ],
    payloadSafety: {
      trustPayloadIncluded: false,
      portableAttestationContentsIncluded: false,
      rawProviderPayloadIncluded: false,
      rawIdentityPayloadIncluded: false,
      rawPropertyPayloadIncluded: false,
      supportMetadataIncluded: false,
      downloadableArtifactIncluded: false,
      publicAccessEnabled: false,
    },
  };
}

describe("buildSecurityAccessForensics", () => {
  it("summarizes suspicious access chains without scores or raw telemetry", () => {
    const summary = buildSecurityAccessForensics({
      grantId: "grant-sensitive-1",
      diagnostic: diagnostic(),
      operatorAuditTimeline: operatorTimeline(),
    });

    expect(summary).toEqual(
      expect.objectContaining({
        schemaVersion: "security_access_forensics.v1",
        internalOnly: true,
        supportSafe: true,
        metadataOnly: true,
        incidentCount: 7,
        requestOriginSummary: expect.objectContaining({
          uniqueIpHashCount: 2,
          ipHashValuesVisible: false,
          rawIpVisible: false,
          rawUserAgentVisible: false,
          userAgentFamilies: ["chrome", "safari"],
        }),
        retention: expect.objectContaining({
          futureEnforcementMission: "feat/security-telemetry-retention-enforcement-v1",
          retentionJobImplemented: false,
        }),
        visibility: expect.objectContaining({
          tenantVisible: false,
          recipientVisible: false,
          institutionVisible: false,
          rawIpIncluded: false,
          riskScoreIncluded: false,
        }),
      })
    );
    expect(summary?.incidents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "repeated_blocked_attempts_observed", count: 5 }),
        expect.objectContaining({ type: "wrong_recipient_attempts_observed", count: 2 }),
        expect.objectContaining({ type: "revoked_access_attempt_observed", count: 1 }),
        expect.objectContaining({ type: "expired_access_attempt_observed", count: 1 }),
        expect.objectContaining({ type: "replay_attempt_observed", count: 1 }),
        expect.objectContaining({ type: "stale_session_attempt_observed", count: 1 }),
        expect.objectContaining({ type: "operator_diagnostic_access_observed", count: 1 }),
      ])
    );
    expect(summary?.chains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "recipient_access_chain", eventCount: 5 }),
        expect.objectContaining({ type: "operator_diagnostic_chain", eventCount: 1 }),
        expect.objectContaining({ type: "lifecycle_context_chain", eventCount: 1 }),
      ])
    );

    const payload = JSON.stringify(summary);
    expect(payload).not.toContain("203.0.113");
    expect(payload).not.toContain("Mozilla/");
    expect(payload).not.toContain("includedClaims");
    expect(payload).not.toContain("provider-secret");
    expect(payload).not.toContain('"score"');
    expect(payload).not.toContain('"profile"');
  });
});
