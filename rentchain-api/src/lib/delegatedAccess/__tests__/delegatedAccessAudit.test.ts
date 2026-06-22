import { describe, expect, it } from "vitest";
import { createDelegatedAccessGrant } from "../delegatedAccessModel";
import { buildDelegatedAccessAuditEvent } from "../delegatedAccessAudit";

describe("delegated access audit foundations", () => {
  it("builds immutable metadata-only delegated audit events with actor attribution", () => {
    const grant = createDelegatedAccessGrant({
      landlordId: "landlord-1",
      delegateUserId: "delegate-1",
      role: "assistant_office_admin",
      propertyScope: {
        mode: "selected",
        propertyIds: ["property-1"],
      },
      workspaceScopes: ["unified_inbox"],
      permissionFlags: ["view", "message"],
      createdByUserId: "owner-1",
    });

    const event = buildDelegatedAccessAuditEvent({
      eventType: "delegated_message_sent",
      actorUserId: "delegate-1",
      actingForLandlordId: "landlord-1",
      delegatedRole: grant.role,
      permissionScope: grant.permissionScope,
      sessionId: "session-1",
      actionType: "message",
      targetResourceType: "message_thread",
      targetResourceId: "thread-1",
      timestamp: "2026-06-22T12:00:00.000Z",
      ipAddress: "203.0.113.10",
      deviceMetadata: {
        userAgent: "test-browser",
      },
      outcome: "allowed",
      reason: "scoped_message_reply",
    });

    expect(event).toMatchObject({
      eventType: "delegated_message_sent",
      actorUserId: "delegate-1",
      actingForLandlordId: "landlord-1",
      delegatedRole: "assistant_office_admin",
      actionType: "message",
      targetResourceType: "message_thread",
      targetResourceId: "thread-1",
      timestamp: "2026-06-22T12:00:00.000Z",
      outcome: "allowed",
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
    });
    expect(event.eventId).toMatch(/^delegated_audit_/);
    expect(event.permissionScope?.billingAccess).toBe(false);
  });

  it("rejects unknown delegated audit event types", () => {
    expect(() =>
      buildDelegatedAccessAuditEvent({
        eventType: "unknown_event",
        actorUserId: "delegate-1",
        actingForLandlordId: "landlord-1",
        actionType: "view",
        targetResourceType: "dashboard",
        outcome: "denied",
      })
    ).toThrow("invalid_delegated_audit_event_type");
  });
});
