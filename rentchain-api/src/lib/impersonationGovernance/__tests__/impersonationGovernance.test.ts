import { describe, expect, it } from "vitest";

import {
  IMPERSONATION_GOVERNANCE_VERSION,
  buildImpersonationActorChain,
  buildImpersonationAuditEvent,
  buildImpersonationTelemetryMeta,
  normalizeImpersonationLifecycleState,
  normalizeImpersonationReasonCategory,
} from "../impersonationGovernance";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";

describe("impersonationGovernance", () => {
  it("normalizes lifecycle states and reason categories deterministically", () => {
    expect(normalizeImpersonationLifecycleState("Started")).toBe("started");
    expect(normalizeImpersonationLifecycleState("revoked")).toBe("revoked");
    expect(normalizeImpersonationLifecycleState("unknown")).toBe("denied");
    expect(normalizeImpersonationReasonCategory("Security Investigation")).toBe("security_investigation");
    expect(normalizeImpersonationReasonCategory("technical-diagnostics")).toBe("technical_diagnostics");
    expect(normalizeImpersonationReasonCategory("unsafe reason")).toBeNull();
  });

  it("requires a privileged real actor and preserves actor chain fields", () => {
    expect(
      buildImpersonationActorChain({
        realActorId: "admin-1",
        realActorRole: "admin",
        effectiveActorId: "tenant-1",
        effectiveActorRole: "tenant",
        impersonationSessionId: "session-1",
      })
    ).toEqual({
      realActorId: "admin-1",
      realActorRole: "admin",
      effectiveActorId: "tenant-1",
      effectiveActorRole: "tenant",
      impersonationSessionId: "session-1",
      actingAsRole: "tenant",
      supportAttribution: true,
    });

    expect(
      buildImpersonationActorChain({
        realActorId: "landlord-1",
        realActorRole: "landlord",
        effectiveActorId: "tenant-1",
        effectiveActorRole: "tenant",
        impersonationSessionId: "session-1",
      })
    ).toBeNull();
  });

  it("builds projection-safe started and ended audit events", () => {
    const started = buildImpersonationAuditEvent({
      eventType: "impersonation.started",
      sessionId: "session-1",
      lifecycleState: "started",
      reasonCategory: "incident_review",
      realActorId: "admin-1",
      realActorRole: "admin",
      effectiveActorId: "tenant-1",
      effectiveActorRole: "tenant",
      targetAccountId: "tenant-1",
      targetAccountType: "tenant",
      targetLandlordId: "landlord-1",
      occurredAt: "2026-05-22T12:00:00.000Z",
      startedAt: "2026-05-22T12:00:00.000Z",
      policyDecision: "allowed",
    });

    expect(started).toEqual(
      expect.objectContaining({
        impersonationGovernanceVersion: IMPERSONATION_GOVERNANCE_VERSION,
        eventType: "impersonation.started",
        lifecycleState: "started",
        reasonCategory: "incident_review",
        visibilityClass: "admin_support_internal",
        metadataOnly: true,
        tenantVisible: false,
        supportProjectionSafe: true,
      })
    );
    expect(started.actorChain).toEqual(
      expect.objectContaining({
        realActorId: "admin-1",
        effectiveActorId: "tenant-1",
        impersonationSessionId: "session-1",
      })
    );

    const ended = buildImpersonationAuditEvent({
      eventType: "impersonation.ended",
      sessionId: "session-1",
      lifecycleState: "ended",
      reasonCategory: "incident_review",
      realActorId: "admin-1",
      realActorRole: "admin",
      effectiveActorId: "tenant-1",
      effectiveActorRole: "tenant",
      targetAccountId: "tenant-1",
      targetAccountType: "tenant",
      targetLandlordId: "landlord-1",
      occurredAt: "2026-05-22T12:05:00.000Z",
      endedAt: "2026-05-22T12:05:00.000Z",
      policyDecision: "allowed",
    });
    expect(ended.lifecycleState).toBe("ended");
    expect(ended.endedAt).toBe("2026-05-22T12:05:00.000Z");

    expectNoRestrictedProjectionFields(started);
    expectNoRestrictedProjectionFields(ended);
    expectPayloadDoesNotContainValues(started, [
      "rawProviderPayload",
      "rawReport",
      "secret-token",
      "Authorization",
      "routeSource",
    ]);
  });

  it("keeps telemetry metadata support-safe and rejects missing reason or actor chains", () => {
    const event = buildImpersonationAuditEvent({
      eventType: "impersonation.started",
      sessionId: "session-1",
      lifecycleState: "started",
      reasonCategory: "technical_diagnostics",
      realActorId: "support-1",
      realActorRole: "support",
      effectiveActorId: "tenant-1",
      effectiveActorRole: "tenant",
      targetAccountId: "tenant-1",
      targetAccountType: "tenant",
      targetLandlordId: "landlord-1",
      occurredAt: "2026-05-22T12:00:00.000Z",
      policyDecision: "allowed",
    });

    const meta = buildImpersonationTelemetryMeta(event);
    expect(meta).toEqual(
      expect.objectContaining({
        realActorId: "support-1",
        effectiveActorId: "tenant-1",
        tenantVisible: false,
        metadataOnly: true,
      })
    );
    expectNoRestrictedProjectionFields(meta);

    expect(() =>
      buildImpersonationAuditEvent({
        ...event,
        reasonCategory: "unsafe",
      })
    ).toThrow("impersonation_reason_required");
    expect(() =>
      buildImpersonationAuditEvent({
        ...event,
        realActorRole: "landlord",
      })
    ).toThrow("impersonation_actor_chain_invalid");
  });
});
