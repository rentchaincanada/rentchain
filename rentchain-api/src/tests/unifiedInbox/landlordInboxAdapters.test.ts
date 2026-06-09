import { describe, expect, it } from "vitest";
import {
  adaptLandlordApplicationInboxToInboxEvent,
  adaptLandlordLeaseInboxToInboxEvent,
  adaptLandlordMaintenanceInboxToInboxEvent,
  adaptLandlordMessageInboxToInboxEvent,
  adaptLandlordScreeningInboxToInboxEvent,
} from "../../services/unifiedInbox";

const landlordContext = {
  landlordId: "landlord_raw_abc",
};

function expectLandlordSafe(event: NonNullable<ReturnType<typeof adaptLandlordApplicationInboxToInboxEvent>>) {
  expect(event.audienceRole).toBe("landlord");
  expect(event.rawIdsIncluded).toBe(false);
  expect(event.tokensIncluded).toBe(false);
  expect(event.secretsIncluded).toBe(false);
  expect(event.providerPayloadIncluded).toBe(false);
  expect(event.storagePathIncluded).toBe(false);
  expect(event.privateNotesIncluded).toBe(false);
  expect(event.id).toMatch(/^inbox_v1_/);
  expect(event.sourceId).toMatch(/^inbox_v1_/);
  expect(event.audienceScopeKey).toMatch(/^scope_v1_/);
  expect(JSON.stringify(event)).not.toContain("landlord_raw_abc");
}

describe("landlord inbox adapters", () => {
  it("projects landlord inbox items into safe events", () => {
    const event = adaptLandlordApplicationInboxToInboxEvent(
      {
        id: "application_raw_123",
        landlordId: "landlord_raw_abc",
        title: "Application ready",
        summary: "Applicant package is ready.",
        priority: "critical",
        occurredAt: "2026-06-09T10:00:00.000Z",
      },
      landlordContext
    );

    expect(event).toMatchObject({
      sourceKind: "landlord.application",
      title: "Application ready",
      body: "Applicant package is ready.",
      priority: "critical",
      status: "unread",
      occurredAt: "2026-06-09T10:00:00.000Z",
    });
    expectLandlordSafe(event!);
    expect(JSON.stringify(event)).not.toContain("application_raw_123");
  });

  it("rejects cross-landlord and sensitive landlord records", () => {
    expect(
      adaptLandlordApplicationInboxToInboxEvent(
        {
          id: "application_raw_123",
          landlordId: "landlord_other",
          title: "Other landlord application",
        },
        landlordContext
      )
    ).toBeNull();

    expect(
      adaptLandlordScreeningInboxToInboxEvent(
        {
          id: "screening_raw_123",
          landlordId: "landlord_raw_abc",
          title: "Screening ready",
          providerPayload: { raw: true },
        },
        landlordContext
      )
    ).toBeNull();

    expect(
      adaptLandlordLeaseInboxToInboxEvent(
        {
          id: "lease_raw_123",
          landlordId: "landlord_raw_abc",
          title: "Secret token exposed",
        },
        landlordContext
      )
    ).toBeNull();
  });

  it("adapts lease, maintenance, and message sources without source mutation", () => {
    const lease = {
      id: "lease_raw_123",
      landlordId: "landlord_raw_abc",
      title: "Lease ready",
      state: "pending",
      updatedAt: "2026-06-09T11:00:00.000Z",
    };
    const maintenance = {
      id: "maintenance_raw_123",
      ownerId: "landlord_raw_abc",
      title: "Bathroom fan",
      status: "submitted",
      updatedAt: "2026-06-09T12:00:00.000Z",
    };
    const message = {
      id: "message_raw_123",
      userId: "landlord_raw_abc",
      senderRole: "tenant",
      body: "Can we schedule a viewing?",
      createdAt: "2026-06-09T13:00:00.000Z",
    };
    const before = JSON.stringify({ lease, maintenance, message });

    const leaseEvent = adaptLandlordLeaseInboxToInboxEvent(lease, landlordContext);
    const maintenanceEvent = adaptLandlordMaintenanceInboxToInboxEvent(maintenance, landlordContext);
    const messageEvent = adaptLandlordMessageInboxToInboxEvent(message, landlordContext);

    expect(leaseEvent).toMatchObject({ sourceKind: "landlord.lease", title: "Lease ready" });
    expect(maintenanceEvent).toMatchObject({ sourceKind: "landlord.maintenance", body: "Status: submitted" });
    expect(messageEvent).toMatchObject({ sourceKind: "landlord.message", title: "Tenant message" });
    expectLandlordSafe(leaseEvent!);
    expectLandlordSafe(maintenanceEvent!);
    expectLandlordSafe(messageEvent!);
    expect(JSON.stringify({ lease, maintenance, message })).toBe(before);
  });
});
