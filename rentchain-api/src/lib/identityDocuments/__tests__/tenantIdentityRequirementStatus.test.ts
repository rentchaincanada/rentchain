import { describe, expect, it } from "vitest";

import { buildTenantIdentityRequirementStatus } from "../tenantIdentityRequirementStatus";

const context = {
  actorUserId: "tenant-user",
  subjectId: "canonical-subject",
  organizationId: "organization",
  tenantId: "tenant",
  applicantParticipantId: "applicant-participant",
  applicationIds: ["application"],
  activeWorkflow: true as const,
};

const policy = {
  requirementPolicyId: "tenant_government_photo_id_required",
  requirementPolicyVersion: "v1",
  policyTextVersion: "v1",
  privacyNoticeVersion: "v1",
  retentionPolicyId: "identity-retention",
  retentionPolicyVersion: "v1",
};

describe("buildTenantIdentityRequirementStatus", () => {
  it("requires an upload without implying verification", () => {
    expect(buildTenantIdentityRequirementStatus({ context, policy, documents: [] })).toMatchObject({
      required: true,
      requirementStatus: "action_required",
      collectionStatus: "not_uploaded",
      verificationStatus: "not_started",
      activeDocumentCount: 0,
      applicationContinuity: true,
      tenantContinuity: true,
      biometricProcessing: false,
      pdfSupported: false,
    });
  });

  it("marks a ready image received while preserving not-started verification", () => {
    const result = buildTenantIdentityRequirementStatus({
      context,
      policy,
      documents: [{ status: "ready", verificationStatus: "not_started" }],
    });
    expect(result.requirementStatus).toBe("satisfied");
    expect(result.collectionStatus).toBe("received");
    expect(result.verificationStatus).toBe("not_started");
    expect(result.acceptedMimeTypes).not.toContain("application/pdf");
  });

  it("does not count replaced or deletion-scheduled records as active", () => {
    const result = buildTenantIdentityRequirementStatus({
      context,
      policy,
      documents: [
        { status: "replaced", verificationStatus: "not_started" },
        { status: "deletion_scheduled", verificationStatus: "not_started" },
      ],
    });
    expect(result.activeDocumentCount).toBe(0);
    expect(result.requirementStatus).toBe("action_required");
  });
});
