import { describe, expect, it } from "vitest";
import { deriveCrossOrganizationTrust } from "../deriveCrossOrganizationTrust";

describe("deriveCrossOrganizationTrust", () => {
  it("derives deterministic guarded trust relationships from operational lineage", () => {
    const trust = deriveCrossOrganizationTrust({
      landlordId: "landlord-1",
      relationshipType: "operational_trust",
      networkParticipants: [{ participantId: "participant-1", status: "verified" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      sharingRooms: [{ sharingRoomId: "room-1", status: "active", publiclyAccessible: false, externalExecutionEnabled: false }],
      auditEvents: [{ eventId: "event-1" }],
      consentRecords: [{ consentId: "consent-1" }],
    });

    expect(trust.status).toBe("verified");
    expect(trust.manualReviewRequired).toBe(true);
    expect(trust.publicTrustExposureEnabled).toBe(false);
    expect(trust.autonomousTrustApprovalEnabled).toBe(false);
    expect(trust.summary.totalReferences).toBeGreaterThan(0);
    expect(trust.canonicalEvents.map((event) => event.eventType)).toContain("cross_organization_trust_derived");
    expect(trust.canonicalEvents.map((event) => event.eventType)).toContain("cross_organization_trust_verified");
  });

  it("blocks sharing trust when consent lineage is missing", () => {
    const trust = deriveCrossOrganizationTrust({
      landlordId: "landlord-1",
      relationshipType: "sharing_trust",
      networkParticipants: [{ participantId: "participant-1", status: "verified" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      sharingRooms: [],
      auditEvents: [{ eventId: "event-1" }],
      consentRecords: [],
    });

    expect(trust.status).toBe("blocked");
    expect(trust.blockedReasons).toContain("Consent/access lineage is missing for sharing trust.");
    expect(trust.trustRestrictions.map((restriction) => restriction.restrictionType)).toContain("consent");
    expect(trust.canonicalEvents.map((event) => event.eventType)).toContain("cross_organization_trust_blocked");
  });

  it("keeps missing lineage review-required and excludes sensitive payloads", () => {
    const trust = deriveCrossOrganizationTrust({
      landlordId: "landlord-1",
      relationshipType: "evidence_trust",
      networkParticipants: [{ participantId: "participant-1", status: "verified", rawGovernmentId: "sensitive-id" }],
      evidencePacks: [],
      operatorReviewSessions: [],
      settlementReadiness: null,
      regulatoryProfiles: [],
      sharingRooms: [],
      auditEvents: [],
      consentRecords: [{ consentId: "consent-1" }],
    });

    expect(trust.status).toBe("review_required");
    expect(trust.evidenceReferences[0]).toEqual(expect.objectContaining({ status: "unavailable" }));
    expect(JSON.stringify(trust)).not.toContain("sensitive-id");
    expect(trust.redactions).toEqual(
      expect.arrayContaining(["Raw government identifiers, screening, and credit bureau payloads are excluded."])
    );
  });
});
