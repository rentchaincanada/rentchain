import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
let generatedId = 0;

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

const dbMock = {
  collection: (name: string) => ({
    async get() {
      const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
        id,
        data: () => data,
      }));
      return { docs, empty: docs.length === 0 };
    },
    doc: (id?: string) => {
      const resolvedId = id || `generated-${++generatedId}`;
      return {
        id: resolvedId,
        async get() {
          const entry = ensureCollection(name).get(resolvedId);
          return {
            id: resolvedId,
            exists: Boolean(entry),
            data: () => entry,
          };
        },
        async set(payload: any, options?: { merge?: boolean }) {
          const current = ensureCollection(name).get(resolvedId) || {};
          ensureCollection(name).set(resolvedId, options?.merge ? { ...current, ...(payload || {}) } : payload || {});
        },
      };
    },
    where: (field: string, _op: string, value: any) => ({
      limit: (_count: number) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => data?.[field] === value)
            .map(([id, data]) => ({
              id,
              data: () => data,
            }));
          return { docs, empty: docs.length === 0 };
        },
      }),
    }),
  }),
};

const resolveTenancyContext = vi.fn();
const loadTenantIdentityRecord = vi.fn();

vi.mock("../../../config/firebase", () => ({ db: dbMock }));
vi.mock("../tenancyContextService", () => ({ resolveTenancyContext }));
vi.mock("../tenantProfileService", () => ({ loadTenantIdentityRecord }));

describe("tenantInstitutionAccessService", () => {
  beforeEach(() => {
    collections.clear();
    generatedId = 0;
    vi.clearAllMocks();
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      leaseId: "lease-1",
    });
    ensureCollection("leases").set("lease-1", {
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      dueDay: 1,
    });
    resolveTenancyContext.mockResolvedValue({
      ok: true,
      authority: "active_tenant",
      propertyId: "prop-1",
      applicationId: "app-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
    });
    loadTenantIdentityRecord.mockResolvedValue({
      identityStatus: "verified",
      profile: { completionStatus: "complete" },
      application: { reusable: true, lastSubmittedAt: "2026-04-20T00:00:00.000Z" },
      documents: { completionStatus: "complete", missingCategories: [] },
      screening: { status: "completed", lastCompletedAt: "2026-04-21T00:00:00.000Z" },
      leases: { activeCount: 1, historicalCount: 1, lastSignedAt: "2026-04-22T00:00:00.000Z" },
      verification: { level: "strong" },
      readinessLabel: "Well established",
      readinessDescription: "Completed verification signals are available.",
    });
  });

  it("previews metadata-only institution access and blocks package summaries until consent", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const preview = await service.previewTenantInstitutionAccess({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "Reviewer@Example.com", displayName: "Reviewer", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: false,
    });

    expect(preview?.lifecycle).toBe("consent_required");
    expect(preview?.recipient.email).toBe("reviewer@example.com");
    expect(preview?.includedClaims).toEqual([]);
    expect(preview?.excludedClaims.length).toBeGreaterThan(0);
    expect(preview?.recipientAccess).toEqual(
      expect.objectContaining({
        enabled: false,
        accessUrl: null,
        accessTokenIssued: false,
        recipientAuthenticationRequired: true,
        downloadEnabled: false,
      })
    );
    const payload = JSON.stringify(preview || {});
    expect(payload).not.toContain("documentUrl");
    expect(payload).not.toContain("paymentMethod");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("externalSubmissionEnabled\":true");
  });

  it("requires consent, recipient, and expiration before creating an access grant", async () => {
    const service = await import("../tenantInstitutionAccessService");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        recipient: { email: "reviewer@example.com" },
        expiresInDays: 7,
        consentAccepted: false,
      })
    ).rejects.toThrow("tenant_institution_access_consent_required");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        expiresInDays: 7,
        consentAccepted: true,
      })
    ).rejects.toThrow("tenant_institution_access_recipient_required");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        recipient: { email: "reviewer@example.com" },
        consentAccepted: true,
      })
    ).rejects.toThrow("tenant_institution_access_expiration_required");
  });

  it("creates, lists, and revokes tenant-owned access grants without public exposure", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "lender",
      recipient: { email: "underwriter@example.com", organizationName: "Example Lender" },
      expiresInDays: 14,
      consentAccepted: true,
    });

    expect(grant?.lifecycle).toBe("active");
    expect(grant?.consent.granted).toBe(true);
    expect(grant?.package.status).toBe("export_ready");
    expect(grant?.recipientAccess.enabled).toBe(false);
    expect(grant?.publicProfileEnabled).toBe(false);
    expect(grant?.events.map((event) => event.eventType)).toContain("tenant_institution_access_granted");
    const payload = JSON.stringify(grant || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("externalSubmissionEnabled\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(ensureCollection("tenantInstitutionAccessGrants").size).toBe(1);
    expect(Array.from(ensureCollection("tenantInstitutionAccessGrants").values())[0]?.tenantId).toBe("tenant-1");

    const listed = await service.listTenantInstitutionAccessGrants({ tenantId: "tenant-1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].grantId).toBe(grant?.grantId);
    expect(listed[0].auditSummary).toEqual(
      expect.objectContaining({
        schemaVersion: "recipient_access_audit.v1",
        metadataOnly: true,
        totalEvents: 1,
        openedReviewCount: 0,
        blockedReviewCount: 0,
      })
    );
    expect(listed[0].auditSummary.visibility).toEqual(
      expect.objectContaining({
        tenantVisible: true,
        trustPayloadIncluded: false,
        supportMetadataIncluded: false,
        rawProviderPayloadIncluded: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
      })
    );

    const blocked = await service.revokeTenantInstitutionAccessGrant({
      tenantId: "tenant-2",
      grantId: grant?.grantId || "",
    });
    expect(blocked).toBe(false);

    const revoked = await service.revokeTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      grantId: grant?.grantId || "",
    });
    expect(revoked && revoked.lifecycle).toBe("revoked");
    expect(revoked && revoked.consent.granted).toBe(false);
    expect(revoked && revoked.recipientAccess.enabled).toBe(false);
    expect(revoked && revoked.package.exportSummaries.length).toBeGreaterThan(0);
  });

  it("allows only the intended authenticated recipient to view metadata-only review summaries", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: true,
    });

    const unauthenticated = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
    });
    expect(unauthenticated.decision.allowed).toBe(false);
    expect(unauthenticated.decision.status).toBe("unauthenticated");

    const wrongRecipient = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "other@example.com",
      requestContext: { ipAddress: "203.0.113.10", userAgent: "Mozilla/5.0 Chrome/120.0", requestId: "req-1" },
    });
    expect(wrongRecipient.decision.allowed).toBe(false);
    expect(wrongRecipient.decision.status).toBe("recipient_mismatch");

    const review = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "Reviewer@Example.com",
      recipientUserId: "recipient-1",
      onboardingAcknowledged: true,
      requestContext: { ipAddress: "203.0.113.10", userAgent: "Mozilla/5.0 Chrome/120.0", requestId: "req-2" },
    });
    expect(review.decision.allowed).toBe(true);
    expect(review.summary?.schemaVersion).toBe("recipient_trust_review.v1");
    expect(review.summary?.session).toEqual(
      expect.objectContaining({
        schemaVersion: "recipient_review_session.v1",
        lifecycle: "active",
        authenticated: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
      })
    );
    expect(review.summary?.institutionReviewSession).toEqual(
      expect.objectContaining({
        schemaVersion: "institution_review_session.v1",
        audience: "insurer",
        purpose: "insurance_review",
        recipientRole: "insurance_reviewer",
        lifecycle: "active",
        tenantMediated: true,
        metadataOnly: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
      })
    );
    expect(review.summary?.institutionReviewSession.lifecycleLinkage).toEqual(
      expect.objectContaining({
        grantLifecycleLinked: true,
        trustExportLifecycleLinked: true,
        recipientSessionLinked: true,
        revocationPropagates: true,
        expirationPropagates: true,
        reverificationPropagates: true,
      })
    );
    expect(review.summary?.access).toEqual(
      expect.objectContaining({
        authenticated: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
        automatedDecisioningEnabled: false,
      })
    );
    expect(review.summary?.includedClaims.length).toBeGreaterThan(0);
    const listed = await service.listTenantInstitutionAccessGrants({ tenantId: "tenant-1" });
    expect(listed[0].auditSummary.openedReviewCount).toBe(1);
    expect(listed[0].auditSummary.blockedReviewCount).toBe(1);
    expect(listed[0].auditSummary.sessionStartedCount).toBe(1);
    expect(listed[0].auditTimeline.map((event) => event.reason)).toEqual(
      expect.arrayContaining(["review_available", "recipient_email_mismatch", "access_granted", "session_started"])
    );
    expect(listed[0].auditSummary.recipientIdentifier.redactedEmail).toBe("re***@example.com");
    const auditPayload = JSON.stringify({
      auditSummary: listed[0].auditSummary,
      auditTimeline: listed[0].auditTimeline,
    });
    expect(auditPayload).not.toContain("tenant-1");
    expect(auditPayload).not.toContain("securityTelemetry");
    expect(auditPayload).not.toContain("203.0.113.10");
    expect(auditPayload).not.toContain("Mozilla");
    expect(auditPayload).not.toContain("policyDecisions");
    expect(auditPayload).not.toContain("supportMetadataIncluded\":true");
    expect(auditPayload).not.toContain("rawProviderPayloadIncluded\":true");
    expect(auditPayload).not.toContain("publicAccessEnabled\":true");
    expect(auditPayload).not.toContain("downloadEnabled\":true");
    const payload = JSON.stringify(review.summary || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("securityTelemetry");
    expect(payload).not.toContain("203.0.113.10");
    expect(payload).not.toContain("Mozilla");
    expect(payload).not.toContain("policyDecisions");
    expect(payload).not.toContain("rawProviderPayloadIncluded\":true");
    expect(payload).not.toContain("rawEvidenceIncluded\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("downloadEnabled\":true");
    expect(payload).not.toContain("accessTokenIssued");
  });

  it("enforces recipient review session expiration and revocation", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: true,
    });

    const firstReview = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "reviewer@example.com",
      recipientUserId: "recipient-1",
    });
    const sessionId = firstReview.summary?.session.sessionId || "";
    expect(sessionId).toBeTruthy();

    ensureCollection("recipientTrustReviewSessions").set(sessionId, {
      ...ensureCollection("recipientTrustReviewSessions").get(sessionId),
      expiresAt: "2020-01-01T00:00:00.000Z",
    });

    const expiredSession = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "reviewer@example.com",
      recipientUserId: "recipient-1",
      onboardingAcknowledged: true,
      recipientSessionId: sessionId,
    });
    expect(expiredSession.decision.allowed).toBe(false);
    expect(expiredSession.decision.status).toBe("session_expired");
    expect(expiredSession.decision.reason).toBe("recipient_session_expired");
    expect(ensureCollection("recipientTrustReviewSessions").get(sessionId)?.lifecycle).toBe("expired");

    const secondReview = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "reviewer@example.com",
      recipientUserId: "recipient-1",
    });
    const activeSessionId = secondReview.summary?.session.sessionId || "";
    expect(activeSessionId).toBeTruthy();

    await service.revokeTenantInstitutionAccessGrant({ tenantId: "tenant-1", grantId: grant?.grantId || "" });
    expect(ensureCollection("recipientTrustReviewSessions").get(activeSessionId)?.lifecycle).toBe("revoked");

    const revoked = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "reviewer@example.com",
      recipientUserId: "recipient-1",
      onboardingAcknowledged: true,
      recipientSessionId: activeSessionId,
    });
    expect(revoked.decision.allowed).toBe(false);
    expect(revoked.decision.status).toBe("revoked");
    expect(revoked.summary).toBeNull();
  });

  it("blocks recipient review for revoked, expired, and policy-denied grants", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const revokedGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    await service.revokeTenantInstitutionAccessGrant({ tenantId: "tenant-1", grantId: revokedGrant?.grantId || "" });
    const revoked = await service.getRecipientTrustReview({
      grantId: revokedGrant?.grantId || "",
      recipientEmail: "reviewer@example.com",
    });
    expect(revoked.decision.allowed).toBe(false);
    expect(revoked.decision.status).toBe("revoked");

    const activeGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "lender",
      recipient: { email: "underwriter@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    ensureCollection("tenantInstitutionAccessGrants").set(activeGrant?.grantId || "", {
      ...ensureCollection("tenantInstitutionAccessGrants").get(activeGrant?.grantId || ""),
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    const expired = await service.getRecipientTrustReview({
      grantId: activeGrant?.grantId || "",
      recipientEmail: "underwriter@example.com",
    });
    expect(expired.decision.allowed).toBe(false);
    expect(expired.decision.status).toBe("expired");

    const blockedGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "auditor",
      recipient: { email: "auditor@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    ensureCollection("tenantInstitutionAccessGrants").set(blockedGrant?.grantId || "", {
      ...ensureCollection("tenantInstitutionAccessGrants").get(blockedGrant?.grantId || ""),
      package: { status: "blocked", exportSummaries: [], blockedReasons: ["test_block"] },
    });
    const blocked = await service.getRecipientTrustReview({
      grantId: blockedGrant?.grantId || "",
      recipientEmail: "auditor@example.com",
    });
    expect(blocked.decision.allowed).toBe(false);
    expect(blocked.decision.status).toBe("blocked");

    const grants = await service.listTenantInstitutionAccessGrants({ tenantId: "tenant-1" });
    const revokedAudit = grants.find((entry) => entry.grantId === revokedGrant?.grantId)?.auditSummary;
    const expiredAudit = grants.find((entry) => entry.grantId === activeGrant?.grantId)?.auditSummary;
    const blockedAudit = grants.find((entry) => entry.grantId === blockedGrant?.grantId)?.auditSummary;
    expect(revokedAudit?.revokedAccessCount).toBeGreaterThan(0);
    expect(grants.find((entry) => entry.grantId === revokedGrant?.grantId)?.auditTimeline.map((event) => event.reason)).toEqual(
      expect.arrayContaining(["access_revoked", "grant_revoked"])
    );
    expect(expiredAudit?.expiredAccessCount).toBe(1);
    expect(grants.find((entry) => entry.grantId === activeGrant?.grantId)?.auditTimeline.map((event) => event.reason)).toEqual(
      expect.arrayContaining(["grant_expired"])
    );
    expect(blockedAudit?.blockedReviewCount).toBe(1);
    expect(grants.find((entry) => entry.grantId === blockedGrant?.grantId)?.auditTimeline.map((event) => event.reason)).toEqual(
      expect.arrayContaining(["grant_blocked"])
    );
  });

  it("builds support-safe institution access diagnostics without trust payload exposure", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: true,
    });

    await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "other@example.com",
      requestContext: { ipAddress: "198.51.100.20", userAgent: "Mozilla/5.0 Firefox/120.0" },
    });
    await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "reviewer@example.com",
      recipientUserId: "recipient-1",
      onboardingAcknowledged: true,
      requestContext: { ipAddress: "198.51.100.20", userAgent: "Mozilla/5.0 Firefox/120.0" },
    });

    const diagnostic = await service.getSupportInstitutionAccessDiagnostic({ grantId: grant?.grantId || "" });
    expect(diagnostic).toEqual(
      expect.objectContaining({
        schemaVersion: "support_institution_access_diagnostics.v1",
        lifecycle: "active",
        audience: "insurer",
        purpose: "insurance_review",
        recipient: expect.objectContaining({
          redactedEmail: "re***@example.com",
          organizationName: "Example Insurance",
        }),
        institutionReviewSession: expect.objectContaining({
          schemaVersion: "institution_review_session.v1",
          audience: "insurer",
          purpose: "insurance_review",
          recipientRole: "insurance_reviewer",
          lifecycle: "active",
          metadataOnly: true,
          publicAccessEnabled: false,
          downloadEnabled: false,
        }),
        audit: expect.objectContaining({
          openedReviewCount: 1,
          blockedReviewCount: 1,
          reasonCategories: expect.arrayContaining([
            "access_granted",
            "institution_review_onboarding_acknowledged",
            "institution_review_onboarding_completed",
            "recipient_email_mismatch",
            "review_available",
          ]),
        }),
        securityTelemetry: expect.objectContaining({
          schemaVersion: "support_safe_security_session_telemetry.v1",
          internalOnly: true,
          metadataOnly: true,
          eventCount: 5,
          blockedAttemptCount: 1,
          wrongRecipientAttemptCount: 1,
          uniqueIpHashCount: 1,
          userAgentFamilies: ["firefox"],
          signals: expect.arrayContaining(["recipient_review_opened", "recipient_session_started", "wrong_recipient_attempt"]),
          retention: expect.objectContaining({
            classification: "security_session_internal",
            nonPortable: true,
            nonExportable: true,
          }),
          redaction: expect.objectContaining({
            ipAddressMode: "hash_only",
            rawIpVisible: false,
            rawUserAgentVisible: false,
            preciseGeolocationIncluded: false,
            deviceFingerprintingIncluded: false,
            riskScoreIncluded: false,
          }),
          visibility: expect.objectContaining({
            supportSafe: true,
            tenantVisible: false,
            recipientVisible: false,
            portableVisible: false,
            trustPayloadIncluded: false,
          }),
        }),
        observability: expect.objectContaining({
          schemaVersion: "institution_review_observability.v1",
          operationalHealth: "attention_required",
          lifecycleMetrics: expect.objectContaining({
            openedReviewCount: 1,
            blockedReviewCount: 1,
          }),
          sessionHealth: expect.objectContaining({
            sessionStartedCount: 1,
            continuityState: "active",
            staleSessionDetected: false,
          }),
          bottlenecks: expect.objectContaining({
            unresolvedBlockedReview: true,
            reviewNeverOpened: false,
          }),
          escalation: expect.objectContaining({
            followUpRequired: true,
            primaryReason: "recipient_access_issue",
            nextOperationalAction: "recipient_followup",
          }),
          visibility: expect.objectContaining({
            supportSafe: true,
            recipientVisible: false,
            trustPayloadIncluded: false,
            publicAccessEnabled: false,
            downloadEnabled: false,
          }),
        }),
        payloadSafety: expect.objectContaining({
          metadataOnly: true,
          supportSafe: true,
          trustPayloadIncluded: false,
          portableAttestationContentsIncluded: false,
          rawProviderPayloadIncluded: false,
          rawIdentityPayloadIncluded: false,
          rawPropertyPayloadIncluded: false,
          supportMetadataIncluded: false,
        }),
      })
    );

    const payload = JSON.stringify(diagnostic || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("reviewer@example.com");
    expect(payload).not.toContain("198.51.100.20");
    expect(payload).not.toContain("Mozilla");
    expect(payload).not.toContain("Firefox/120.0");
    expect(payload).not.toContain("includedClaims");
    expect(payload).not.toContain("exportSummaries");
    expect(payload).not.toContain("policyDecisions");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("rawProviderPayloadIncluded\":true");
  });
});
