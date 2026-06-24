import { describe, expect, it } from "vitest";
import { activateLandlordCompanyRelationship, createLandlordCompanyRelationship } from "../propertyManagerCompanyModel";
import { buildPropertyManagerCompanyAuditEvent } from "../propertyManagerCompanyAudit";

function relationship() {
  return activateLandlordCompanyRelationship(
    createLandlordCompanyRelationship({
      landlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      propertyScope: {
        mode: "selected_properties",
        propertyIds: ["property-1"],
      },
      workspaceScopes: ["dashboard", "operations"],
      createdByLandlordOwnerUserId: "landlord-owner-1",
      createdAt: "2026-06-24T01:00:00.000Z",
    }),
    {
      acceptedByCompanyAdminUserId: "company-admin-1",
      startedAt: "2026-06-24T02:00:00.000Z",
    }
  );
}

describe("property manager company audit foundations", () => {
  it("builds metadata-only lifecycle audit events with actor and relationship attribution", () => {
    const activeRelationship = relationship();
    const event = buildPropertyManagerCompanyAuditEvent({
      eventType: "landlord_company_relationship_activated",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      propertyManagerCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      relationshipId: activeRelationship.relationshipId,
      role: "company_admin",
      scope: activeRelationship.relationshipScope,
      targetResourceType: "landlord_company_relationship",
      targetResourceId: activeRelationship.relationshipId,
      outcome: "allowed",
      timestamp: "2026-06-24T02:00:00.000Z",
      reason: "relationship accepted",
      statusTransition: { from: "pending", to: "active" },
    });

    expect(event).toMatchObject({
      eventType: "landlord_company_relationship_activated",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      propertyManagerCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      relationshipId: activeRelationship.relationshipId,
      role: "company_admin",
      targetResourceType: "landlord_company_relationship",
      targetResourceId: activeRelationship.relationshipId,
      outcome: "allowed",
      timestamp: "2026-06-24T02:00:00.000Z",
      statusTransition: { from: "pending", to: "active" },
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
    });
    expect(event.eventId).toMatch(/^pm_company_audit_/);
    expect(event.scope?.propertyScope.propertyIds).toEqual(["property-1"]);
  });

  it("supports membership and termination audit event shapes", () => {
    const membershipEvent = buildPropertyManagerCompanyAuditEvent({
      eventType: "property_manager_company_membership_created",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      propertyManagerCompanyId: "pm-company-1",
      role: "company_admin",
      targetResourceType: "company_membership",
      targetResourceId: "membership-1",
      outcome: "created",
      timestamp: "2026-06-24T03:00:00.000Z",
    });

    expect(membershipEvent).toMatchObject({
      eventType: "property_manager_company_membership_created",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      actingForLandlordId: null,
      relationshipId: null,
      role: "company_admin",
      outcome: "created",
    });

    const terminationEvent = buildPropertyManagerCompanyAuditEvent({
      eventType: "landlord_company_relationship_terminated",
      actorUserId: "landlord-owner-1",
      actingForLandlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      relationshipId: "relationship-1",
      targetResourceType: "landlord_company_relationship",
      targetResourceId: "relationship-1",
      outcome: "terminated",
      timestamp: "2026-06-26T00:00:00.000Z",
      reason: "Contract ended",
      statusTransition: { from: "suspended", to: "terminated" },
    });

    expect(terminationEvent).toMatchObject({
      eventType: "landlord_company_relationship_terminated",
      actorUserId: "landlord-owner-1",
      actorCompanyId: null,
      propertyManagerCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      relationshipId: "relationship-1",
      outcome: "terminated",
      reason: "Contract ended",
      statusTransition: { from: "suspended", to: "terminated" },
      metadataOnly: true,
    });
  });

  it("builds metadata-only staff assignment audit events", () => {
    const activeRelationship = relationship();
    const event = buildPropertyManagerCompanyAuditEvent({
      eventType: "staff_assignment_created",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      propertyManagerCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      relationshipId: activeRelationship.relationshipId,
      assignmentId: "assignment-1",
      staffUserId: "staff-user-1",
      role: "property_manager",
      scope: activeRelationship.relationshipScope,
      targetResourceType: "staff_assignment",
      targetResourceId: "assignment-1",
      outcome: "created",
      timestamp: "2026-06-24T04:00:00.000Z",
      statusTransition: { from: null, to: "active" },
    });

    expect(event).toMatchObject({
      eventType: "staff_assignment_created",
      actorUserId: "company-admin-1",
      actorCompanyId: "pm-company-1",
      propertyManagerCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      relationshipId: activeRelationship.relationshipId,
      assignmentId: "assignment-1",
      staffUserId: "staff-user-1",
      role: "property_manager",
      targetResourceType: "staff_assignment",
      targetResourceId: "assignment-1",
      outcome: "created",
      statusTransition: { from: null, to: "active" },
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
    });
  });

  it("rejects unknown audit event types", () => {
    expect(() =>
      buildPropertyManagerCompanyAuditEvent({
        eventType: "unknown_event",
        actorUserId: "user-1",
        targetResourceType: "property_manager_company",
        targetResourceId: "pm-company-1",
        outcome: "failed",
      })
    ).toThrow("invalid_property_manager_company_audit_event_type");
  });
});
