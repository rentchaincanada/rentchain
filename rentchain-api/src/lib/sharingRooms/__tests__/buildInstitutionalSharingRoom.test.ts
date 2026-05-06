import { describe, expect, it } from "vitest";
import {
  buildInstitutionalSharingRoom,
  normalizeInstitutionalSharingRoom,
  parseSharingRoomCreateRequest,
  revokeInstitutionalSharingRoom,
} from "../buildInstitutionalSharingRoom";

const actor = { userId: "landlord-1", role: "landlord" as const, email: "landlord@example.com" };

describe("buildInstitutionalSharingRoom", () => {
  it("builds deterministic permissioned rooms with safe flags and redactions", () => {
    const request = parseSharingRoomCreateRequest({
      roomType: "lender_review",
      institutionType: "lender",
      redactionLevel: "strict",
      sharedScopes: [
        { scopeKey: "evidence_pack", scopeId: "decision-1", label: "Decision evidence" },
        { scopeKey: "identity_lineage", scopeId: "tenant-1", label: "Tenant identity lineage" },
      ],
    });

    expect(request).toBeTruthy();
    const room = buildInstitutionalSharingRoom({
      landlordId: "landlord-1",
      request: request!,
      actor,
      now: "2026-05-06T00:00:00.000Z",
    });

    expect(room).toEqual(
      expect.objectContaining({
        roomType: "lender_review",
        status: "review_required",
        manualReviewRequired: true,
        publiclyAccessible: false,
        externalExecutionEnabled: false,
        tokenizationEnabled: false,
      })
    );
    expect(room.accessControls).toEqual(
      expect.objectContaining({
        accessType: "view_only",
        publicAccess: false,
        downloadEnabled: false,
        externalSubmissionEnabled: false,
        manualApprovalRequired: true,
      })
    );
    expect(room.expiresAt).toBe("2026-05-20T00:00:00.000Z");
    expect(room.redactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldCategory: "government_identity_numbers", state: "excluded" }),
        expect.objectContaining({ fieldCategory: "payment_account_details", state: "excluded" }),
      ])
    );
    expect(room.auditReferences.map((event) => event.eventType)).toEqual([
      "institutional_sharing_room_created",
      "institutional_sharing_room_review_required",
      "institutional_sharing_room_redaction_applied",
    ]);
  });

  it("marks expired rooms deterministically", () => {
    const room = normalizeInstitutionalSharingRoom(
      {
        sharingRoomId: "room-1",
        landlordId: "landlord-1",
        roomType: "auditor_review",
        createdAt: "2026-05-01T00:00:00.000Z",
        expiresAt: "2026-05-02T00:00:00.000Z",
        accessControls: { institutionType: "auditor", status: "active", redactionLevel: "strict" },
        sharedScopes: [{ scopeKey: "audit_compliance", scopeId: "readiness-1", label: "Readiness" }],
      },
      "2026-05-06T00:00:00.000Z"
    );

    expect(room?.status).toBe("expired");
  });

  it("revokes access without deleting lineage", () => {
    const request = parseSharingRoomCreateRequest({
      roomType: "insurer_review",
      institutionType: "insurer",
      sharedScopes: [{ scopeKey: "institution_export", scopeId: "package-1" }],
    })!;
    const room = buildInstitutionalSharingRoom({
      landlordId: "landlord-1",
      request,
      actor,
      now: "2026-05-06T00:00:00.000Z",
    });

    const revoked = revokeInstitutionalSharingRoom({ room, now: "2026-05-07T00:00:00.000Z" });

    expect(revoked.status).toBe("expired");
    expect(revoked.accessControls.status).toBe("revoked");
    expect(revoked.sharedScopes).toHaveLength(1);
    expect(revoked.auditReferences).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "institutional_sharing_room_access_revoked" })])
    );
  });

  it("rejects invalid or empty create requests", () => {
    expect(parseSharingRoomCreateRequest({ roomType: "public_room", institutionType: "lender", sharedScopes: [] })).toBeNull();
    expect(parseSharingRoomCreateRequest({ roomType: "lender_review", institutionType: "lender", sharedScopes: [] })).toBeNull();
  });

  it("does not include sensitive raw payloads from request fields", () => {
    const request = parseSharingRoomCreateRequest({
      roomType: "lender_review",
      institutionType: "lender",
      sharedScopes: [{ scopeKey: "identity_lineage", scopeId: "tenant-1", rawGovernmentId: "sensitive-government-id" }],
      rawCreditPayload: "sensitive-credit-payload",
      paymentAccount: "sensitive-payment-account",
    })!;
    const room = buildInstitutionalSharingRoom({ landlordId: "landlord-1", request, actor });

    const serialized = JSON.stringify(room);
    expect(serialized).not.toContain("sensitive-government-id");
    expect(serialized).not.toContain("sensitive-credit-payload");
    expect(serialized).not.toContain("sensitive-payment-account");
  });
});
