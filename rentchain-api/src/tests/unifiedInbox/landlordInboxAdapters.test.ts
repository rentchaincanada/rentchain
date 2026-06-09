import { describe, expect, it } from "vitest";
import {
  adaptLandlordApplicationInboxToInboxEvent,
  adaptLandlordApplicationStatusToInboxEvent,
  adaptLandlordLeaseInboxToInboxEvent,
  adaptLandlordLeaseNoticeToInboxEvent,
  adaptLandlordMaintenanceInboxToInboxEvent,
  adaptLandlordMessageInboxToInboxEvent,
  adaptLandlordScreeningInboxToInboxEvent,
  adaptLandlordViewingRequestToInboxEvent,
  adaptLandlordWorkOrderToInboxEvent,
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

  it("adapts landlord viewing requests, work orders, notices, and application statuses", () => {
    const viewing = adaptLandlordViewingRequestToInboxEvent(
      {
        id: "viewing_raw_123",
        landlordId: "landlord_raw_abc",
        applicantName: "Jordan Lee",
        applicantEmail: "jordan@example.com",
        status: "slots_proposed",
        updatedAt: "2026-06-09T10:00:00.000Z",
      },
      landlordContext
    );
    const workOrder = adaptLandlordWorkOrderToInboxEvent(
      {
        id: "work_order_raw_123",
        landlordId: "landlord_raw_abc",
        category: "plumbing",
        status: "overdue",
        dueDate: "2026-06-10T12:00:00.000Z",
      },
      landlordContext
    );
    const notice = adaptLandlordLeaseNoticeToInboxEvent(
      {
        id: "notice_raw_123",
        landlordId: "landlord_raw_abc",
        tenantName: "Jordan Lee",
        noticeType: "renewal_offer",
        status: "served",
        servedAt: "2026-06-09T11:00:00.000Z",
      },
      landlordContext
    );
    const application = adaptLandlordApplicationStatusToInboxEvent(
      {
        id: "application_raw_456",
        landlordId: "landlord_raw_abc",
        applicantName: "Jordan Lee",
        status: "requires_decision",
        updatedAt: "2026-06-09T12:00:00.000Z",
      },
      landlordContext
    );

    expect(viewing).toMatchObject({ sourceKind: "landlord.viewing", title: "Viewing needs confirmation", priority: "high" });
    expect(workOrder).toMatchObject({ sourceKind: "landlord.work_order", title: "Work order update", priority: "high" });
    expect(notice).toMatchObject({ sourceKind: "landlord.notice", title: "Notice sent to tenant" });
    expect(application).toMatchObject({ sourceKind: "landlord.application", title: "Your decision needed", priority: "high" });
    [viewing, workOrder, notice, application].forEach((event) => expectLandlordSafe(event!));
    expect(JSON.stringify([viewing, workOrder, notice, application])).not.toContain("landlord_raw_abc");
    expect(JSON.stringify([viewing, workOrder, notice, application])).not.toContain("work_order_raw_");
  });

  it("rejects new landlord source records outside scope or with sensitive fields", () => {
    expect(
      adaptLandlordViewingRequestToInboxEvent(
        {
          id: "viewing_raw_123",
          landlordId: "landlord_other",
          status: "requested",
        },
        landlordContext
      )
    ).toBeNull();
    expect(
      adaptLandlordWorkOrderToInboxEvent(
        {
          id: "work_order_raw_123",
          landlordId: "landlord_raw_abc",
          status: "assigned",
          contractorInternalNotes: "private",
        },
        landlordContext
      )
    ).toBeNull();
    expect(
      adaptLandlordLeaseNoticeToInboxEvent(
        {
          id: "notice_raw_123",
          landlordId: "landlord_raw_abc",
          status: "served",
          adminMetadata: { internal: true },
        },
        landlordContext
      )
    ).toBeNull();
    expect(
      adaptLandlordApplicationStatusToInboxEvent(
        {
          id: "application_raw_123",
          landlordId: "landlord_raw_abc",
          status: "requires_decision",
          screeningReport: { raw: true },
        },
        landlordContext
      )
    ).toBeNull();
  });
});
