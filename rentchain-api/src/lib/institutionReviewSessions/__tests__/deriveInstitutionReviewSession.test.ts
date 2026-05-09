import { describe, expect, it } from "vitest";
import { deriveInstitutionReviewSession } from "../deriveInstitutionReviewSession";

function grant(patch: Record<string, any> = {}) {
  return {
    grantId: "grant-1",
    lifecycle: "active",
    audience: "lender",
    purpose: "lender_review",
    recipient: {
      email: "underwriter@example.com",
      organizationName: "Example Lender",
      authenticationRequirement: "recipient_email_session_required",
    },
    consent: {
      granted: true,
      expiresAt: "2026-06-01T00:00:00.000Z",
      revokedAt: null,
    },
    expiresAt: "2026-06-01T00:00:00.000Z",
    revokedAt: null,
    generatedAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    package: {
      exportId: "export-1",
      status: "export_ready",
      lifecycleControl: {
        state: "active",
        active: true,
        shareable: true,
        metadataOnly: true,
      },
    },
    ...patch,
  };
}

describe("deriveInstitutionReviewSession", () => {
  it("derives institution audience, purpose, role, and active lifecycle from recipient session context", () => {
    const summary = deriveInstitutionReviewSession({
      accessGrant: grant(),
      recipientReviewSession: {
        sessionId: "recipient-session-1",
        lifecycle: "active",
        lastValidatedAt: "2026-05-02T00:00:00.000Z",
      },
      generatedAt: "2026-05-02T00:00:00.000Z",
    });

    expect(summary).toEqual(
      expect.objectContaining({
        schemaVersion: "institution_review_session.v1",
        accessGrantId: "grant-1",
        recipientReviewSessionId: "recipient-session-1",
        audience: "lender",
        purpose: "lender_review",
        recipientRole: "lender_reviewer",
        lifecycle: "active",
        tenantMediated: true,
        consentScoped: true,
        policyGated: true,
        metadataOnly: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
        automatedDecisioningEnabled: false,
      })
    );
    expect(summary.lifecycleLinkage).toEqual(
      expect.objectContaining({
        grantLifecycleLinked: true,
        trustExportLifecycleLinked: true,
        recipientSessionLinked: true,
        revocationPropagates: true,
        expirationPropagates: true,
        reverificationPropagates: true,
      })
    );
    expect(summary.recipient).toEqual(
      expect.objectContaining({
        role: "lender_reviewer",
        redactedEmail: "un***@example.com",
        organizationName: "Example Lender",
      })
    );
    expect(summary.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["institution_review_session_created", "institution_review_session_opened"])
    );
    const payload = JSON.stringify(summary);
    expect(payload).not.toContain("underwriter@example.com");
    expect(payload).not.toContain("exportSummaries");
    expect(payload).not.toContain("policyDecisions");
    expect(payload).not.toContain("rawProviderPayloadIncluded\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
  });

  it("links revoked, expired, and reverification-required source states into session lifecycle", () => {
    expect(
      deriveInstitutionReviewSession({
        accessGrant: grant({ lifecycle: "revoked", revokedAt: "2026-05-03T00:00:00.000Z" }),
        generatedAt: "2026-05-04T00:00:00.000Z",
      }).lifecycle
    ).toBe("revoked");

    expect(
      deriveInstitutionReviewSession({
        accessGrant: grant({ expiresAt: "2026-04-01T00:00:00.000Z" }),
        generatedAt: "2026-05-04T00:00:00.000Z",
      }).lifecycle
    ).toBe("expired");

    const reverification = deriveInstitutionReviewSession({
      accessGrant: grant({
        package: {
          exportId: "export-1",
          status: "blocked",
          lifecycleControl: { state: "reverification_required", active: false, shareable: false, metadataOnly: true },
        },
      }),
      generatedAt: "2026-05-04T00:00:00.000Z",
    });
    expect(reverification.lifecycle).toBe("reverification_required");
    expect(reverification.events.map((event) => event.eventType)).toContain(
      "institution_review_session_reverification_required"
    );
  });

  it("represents pending and session-closed states without opening access", () => {
    const pending = deriveInstitutionReviewSession({
      accessGrant: grant(),
      generatedAt: "2026-05-02T00:00:00.000Z",
    });
    expect(pending.lifecycle).toBe("pending");
    expect(pending.lifecycleLinkage.recipientSessionLinked).toBe(false);

    const closed = deriveInstitutionReviewSession({
      accessGrant: grant(),
      recipientReviewSession: { sessionId: "recipient-session-1", lifecycle: "expired" },
      generatedAt: "2026-05-02T00:00:00.000Z",
    });
    expect(closed.lifecycle).toBe("session_closed");
    expect(closed.events.map((event) => event.eventType)).toContain("institution_review_session_closed");
  });
});
