import { describe, expect, it } from "vitest";
import { deriveNetworkParticipantProfile } from "../deriveNetworkParticipantProfile";

describe("deriveNetworkParticipantProfile", () => {
  it("derives deterministic guarded network participant profile", () => {
    const profile = deriveNetworkParticipantProfile({
      landlordId: "landlord-1",
      participantType: "lender",
      participantId: "lender-1",
      identityProfiles: [{ identityId: "organization:lender-1", identityType: "organization", status: "verified" }],
      sharingRooms: [
        {
          sharingRoomId: "room-1",
          status: "active",
          publiclyAccessible: false,
          externalExecutionEnabled: false,
          accessControls: { institutionType: "lender" },
        },
      ],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
    });

    expect(profile.participantType).toBe("lender");
    expect(profile.status).toBe("verified");
    expect(profile.manualReviewRequired).toBe(true);
    expect(profile.publiclyDiscoverable).toBe(false);
    expect(profile.externalRelationshipExecutionEnabled).toBe(false);
    expect(profile.relationshipReferences.some((relationship) => relationship.relationshipType === "sharing_relationship")).toBe(true);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("network_participant_profile_derived");
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("network_relationship_verified");
  });

  it("blocks unsafe public or external sharing relationships", () => {
    const profile = deriveNetworkParticipantProfile({
      landlordId: "landlord-1",
      participantType: "auditor",
      participantId: "auditor-1",
      identityProfiles: [{ identityId: "organization:auditor-1", identityType: "organization", status: "verified" }],
      sharingRooms: [
        {
          sharingRoomId: "room-unsafe",
          status: "active",
          publiclyAccessible: true,
          externalExecutionEnabled: false,
          accessControls: { institutionType: "auditor" },
        },
      ],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.blockedReasons).toContain("Public access or external execution is not allowed for network participants.");
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("network_relationship_blocked");
  });

  it("keeps missing institutional identity review-required and redacted", () => {
    const profile = deriveNetworkParticipantProfile({
      landlordId: "landlord-1",
      participantType: "regulator",
      participantId: "regulator-1",
      identityProfiles: [],
      sharingRooms: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.identityReferences[0]).toEqual(expect.objectContaining({ status: "missing" }));
    expect(JSON.stringify(profile)).not.toContain("rawGovernmentId");
    expect(profile.redactions).toEqual(expect.arrayContaining(["Private identity details and raw government identifiers are excluded."]));
  });
});
