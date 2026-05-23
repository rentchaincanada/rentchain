import { describe, expect, it } from "vitest";
import {
  buildAdminSecurityIncidentReviewDetail,
  buildAdminSecurityIncidentReviewRecord,
  filterAdminSecurityIncidentRecords,
} from "../adminSecurityIncidentReview";

describe("adminSecurityIncidentReview", () => {
  it("classifies impersonation telemetry without exposing actor-chain internals", () => {
    const incident = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "telemetry_events",
      documentId: "telemetry-1",
      data: {
        type: "impersonation.started",
        actor: "admin-raw-id",
        landlordId: "landlord-raw-id",
        ts: 1779540000000,
        meta: {
          realActorId: "admin-raw-id",
          realActorRole: "admin",
          effectiveActorId: "tenant-raw-id",
          effectiveActorRole: "tenant",
          impersonationSessionId: "session-raw-id",
          reasonCategory: "security_investigation",
          sourceActionFamily: "admin_support_impersonation",
          policyDecision: "allowed",
          token: "secret-token",
        },
      },
    });

    expect(incident).toEqual(
      expect.objectContaining({
        category: "impersonation_started",
        metadataOnly: true,
        actorSummary: expect.objectContaining({
          role: "admin",
          supportAttribution: true,
          rawActorIdsIncluded: false,
        }),
        targetSummary: expect.objectContaining({
          accountType: "tenant",
          landlordScoped: true,
          rawTargetIdsIncluded: false,
        }),
      })
    );
    const payload = JSON.stringify(incident);
    expect(payload).not.toContain("admin-raw-id");
    expect(payload).not.toContain("tenant-raw-id");
    expect(payload).not.toContain("session-raw-id");
    expect(payload).not.toContain("secret-token");
  });

  it("classifies route-source and projection safety events as metadata-only review records", () => {
    const route = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "events",
      documentId: "event-1",
      data: {
        eventType: "route_source_anomaly",
        occurredAt: "2026-05-23T12:00:00.000Z",
        routeSource: "not-found",
        sourceRoute: "/api/tenant/trust-exports",
        requestBody: { authorization: "Bearer secret" },
      },
    });
    const projection = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "events",
      documentId: "event-2",
      data: {
        eventType: "projection_safety_redaction",
        occurredAt: "2026-05-23T12:05:00.000Z",
        rawProviderPayload: "sensitive",
      },
    });

    expect(route?.category).toBe("route_source_anomaly");
    expect(route?.severity).toBe("high");
    expect(projection?.category).toBe("projection_safety_redaction");
    expect(projection?.status).toBe("reviewing");
    expect(JSON.stringify([route, projection])).not.toContain("Bearer secret");
    expect(JSON.stringify([route, projection])).not.toContain("sensitive");
  });

  it("fails safe for unsupported events and filters supported records deterministically", () => {
    const unsupported = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "events",
      documentId: "event-unrelated",
      data: { eventType: "lease_updated", occurredAt: "2026-05-23T12:00:00.000Z" },
    });
    expect(unsupported).toBeNull();

    const first = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "events",
      documentId: "event-1",
      data: { eventType: "admin_access_denied", occurredAt: "2026-05-23T12:00:00.000Z" },
    })!;
    const second = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "events",
      documentId: "event-2",
      data: { eventType: "export_blocked", occurredAt: "2026-05-23T12:00:00.000Z" },
    })!;

    expect(filterAdminSecurityIncidentRecords([first, second], { category: "export_blocked" })).toEqual([second]);
    expect(filterAdminSecurityIncidentRecords([first, second], { q: "admin access" })).toEqual([first]);
  });

  it("builds safe detail records without raw event JSON", () => {
    const incident = buildAdminSecurityIncidentReviewRecord({
      sourceCollection: "telemetry_events",
      documentId: "telemetry-2",
      data: { type: "policy.denied", ts: 1779540000000, meta: { policyDecision: "denied", stackTrace: "hidden" } },
    })!;
    const detail = buildAdminSecurityIncidentReviewDetail(incident);

    expect(detail.timeline).toHaveLength(1);
    expect(detail.relatedEventSummaries[0]).toEqual(expect.objectContaining({ metadataOnly: true }));
    expect(JSON.stringify(detail)).not.toContain("hidden");
    expect(JSON.stringify(detail)).not.toContain("stackTrace");
  });
});

