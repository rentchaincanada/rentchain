import { describe, expect, it } from "vitest";
import { deriveInstitutionOnboardingReadiness } from "../deriveInstitutionOnboardingReadiness";

describe("deriveInstitutionOnboardingReadiness", () => {
  it("derives deterministic guarded onboarding readiness from operational lineage", () => {
    const readiness = deriveInstitutionOnboardingReadiness({
      landlordId: "landlord-1",
      institutionType: "lender",
      networkParticipants: [{ participantId: "participant-1", status: "verified" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
      identityProfiles: [{ identityId: "organization:lender-1", status: "verified" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      sharingRooms: [{ sharingRoomId: "room-1", status: "active", publiclyAccessible: false, externalExecutionEnabled: false }],
      auditEvents: [{ eventId: "event-1" }],
      consentRecords: [{ consentId: "consent-1" }],
    });

    expect(readiness.institutionType).toBe("lender");
    expect(readiness.status).toBe("ready_for_review");
    expect(readiness.manualReviewRequired).toBe(true);
    expect(readiness.externalOnboardingEnabled).toBe(false);
    expect(readiness.autonomousApprovalEnabled).toBe(false);
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("institution_onboarding_readiness_derived");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("institution_onboarding_redaction_applied");
  });

  it("blocks onboarding when sharing and consent lineage are missing", () => {
    const readiness = deriveInstitutionOnboardingReadiness({
      landlordId: "landlord-1",
      institutionType: "auditor",
      networkParticipants: [{ participantId: "participant-1", status: "verified" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
      identityProfiles: [{ identityId: "organization:auditor-1", status: "verified" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      sharingRooms: [],
      auditEvents: [{ eventId: "event-1" }],
      consentRecords: [],
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockedReasons).toContain("Consent/access lineage is missing for institution onboarding.");
    expect(readiness.onboardingRestrictions.map((restriction) => restriction.restrictionType)).toContain("consent");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("institution_onboarding_blocked");
  });

  it("keeps missing evidence review-required and excludes sensitive payloads", () => {
    const readiness = deriveInstitutionOnboardingReadiness({
      landlordId: "landlord-1",
      institutionType: "regulator",
      networkParticipants: [{ participantId: "participant-1", status: "verified", rawGovernmentId: "sensitive-id" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
      identityProfiles: [{ identityId: "organization:regulator-1", status: "verified" }],
      evidencePacks: [],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      sharingRooms: [{ sharingRoomId: "room-1", status: "active", publiclyAccessible: false, externalExecutionEnabled: false }],
      auditEvents: [{ eventId: "event-1" }],
      consentRecords: [{ consentId: "consent-1" }],
    });

    expect(readiness.status).toBe("review_required");
    expect(readiness.evidenceReferences[0]).toEqual(expect.objectContaining({ status: "unavailable" }));
    expect(JSON.stringify(readiness)).not.toContain("sensitive-id");
    expect(readiness.redactions).toEqual(
      expect.arrayContaining(["Raw government identifiers, screening, and credit bureau payloads are excluded."])
    );
  });
});
