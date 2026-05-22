import { describe, expect, it } from "vitest";
import {
  projectAdminSupportMetadataForAudience,
  stripAdminSupportInternalsForUser,
} from "../adminSupportProjectionSafety";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";

const IMPERSONATION_PAYLOAD = {
  eventType: "impersonation.started",
  sessionId: "session-1",
  lifecycleState: "started",
  reasonCategory: "incident_review",
  occurredAt: "2026-05-22T20:00:00.000Z",
  startedAt: "2026-05-22T20:00:00.000Z",
  targetAccountType: "tenant",
  targetAccountId: "tenant-1",
  targetLandlordId: "landlord-1",
  realActorId: "admin-1",
  realActorRole: "admin",
  effectiveActorId: "tenant-1",
  effectiveActorRole: "tenant",
  impersonationSessionId: "session-1",
  impersonationReason: "incident_review",
  impersonationStartedAt: "2026-05-22T20:00:00.000Z",
  impersonationActive: true,
  supportProjectionSafe: true,
  visibilityClass: "admin_support_internal",
  sourceActionFamily: "admin_support_impersonation",
  policyDecision: "allowed",
  tenantVisible: false,
  actorChain: {
    realActorId: "admin-1",
    realActorRole: "admin",
    effectiveActorId: "tenant-1",
    effectiveActorRole: "tenant",
    impersonationSessionId: "session-1",
  },
  rawProviderPayload: { token: "secret-token" },
  debugPayload: { stack: "private stack trace" },
};

function serialized(value: unknown) {
  return JSON.stringify(value);
}

describe("adminSupportProjectionSafety", () => {
  it("strips impersonation and support internals from landlord projections", () => {
    const result = projectAdminSupportMetadataForAudience(
      {
        label: "Lease timeline",
        supportEvent: IMPERSONATION_PAYLOAD,
        publicCount: 2,
      },
      "landlord"
    );

    expect(result).toEqual({
      label: "Lease timeline",
      supportEvent: {},
      publicCount: 2,
    });
    expect(serialized(result)).not.toContain("realActorId");
    expect(serialized(result)).not.toContain("impersonationSessionId");
    expect(serialized(result)).not.toContain("supportProjectionSafe");
    expectPayloadDoesNotContainValues(result, ["admin-1", "tenant-1", "secret-token", "private stack trace"]);
    expectNoRestrictedProjectionFields(result);
  });

  it("strips impersonation and support internals from tenant projections", () => {
    const result = projectAdminSupportMetadataForAudience(
      {
        tenantWorkspace: { status: "active" },
        event: IMPERSONATION_PAYLOAD,
      },
      "tenant"
    );

    expect(result).toEqual({
      tenantWorkspace: { status: "active" },
      event: {},
    });
    expect(serialized(result)).not.toContain("impersonationReason");
    expect(serialized(result)).not.toContain("visibilityClass");
    expectPayloadDoesNotContainValues(result, ["incident_review", "admin_support_internal", "admin-1"]);
  });

  it("fails safe for unknown and user-safe export audiences", () => {
    const unknownAudience = projectAdminSupportMetadataForAudience(IMPERSONATION_PAYLOAD, "partner");
    const exportAudience = stripAdminSupportInternalsForUser(IMPERSONATION_PAYLOAD);

    expect(unknownAudience).toEqual({});
    expect(exportAudience).toEqual({});
    expectPayloadDoesNotContainValues({ unknownAudience, exportAudience }, [
      "realActorId",
      "effectiveActorId",
      "impersonationSessionId",
      "admin-1",
      "tenant-1",
    ]);
  });

  it("returns metadata-only admin/support summaries without raw actor chains", () => {
    const result = projectAdminSupportMetadataForAudience(IMPERSONATION_PAYLOAD, "admin_support");

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: "admin_support_projection_safety_v1",
        sessionId: "session-1",
        lifecycleState: "started",
        reasonCategory: "incident_review",
        targetSummary: expect.objectContaining({
          accountType: "tenant",
          landlordScoped: true,
          rawTargetIdsIncluded: false,
        }),
        actorSummary: expect.objectContaining({
          realActorRole: "admin",
          effectiveActorRole: "tenant",
          rawActorIdsIncluded: false,
        }),
        metadataOnly: true,
        tenantVisible: false,
        supportSafe: true,
      })
    );
    expect(serialized(result)).not.toContain("realActorId");
    expect(serialized(result)).not.toContain("effectiveActorId");
    expect(serialized(result)).not.toContain("actorChain");
    expectPayloadDoesNotContainValues(result, ["admin-1", "tenant-1", "secret-token", "private stack trace"]);
    expectNoRestrictedProjectionFields(result);
  });
});
