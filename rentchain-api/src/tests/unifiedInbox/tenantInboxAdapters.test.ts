import { describe, expect, it } from "vitest";
import {
  adaptTenantApplicationStatusToInboxEvent,
  adaptTenantLeaseNoticeToInboxEvent,
  adaptTenantMaintenanceToInboxEvent,
  adaptTenantMessageToInboxEvent,
  adaptTenantNotificationToInboxEvent,
  adaptTenantScreeningToInboxEvent,
  adaptTenantViewingRequestToInboxEvent,
} from "../../services/unifiedInbox";

const tenantContext = {
  tenantWorkspaceId: "tenant_workspace_raw_abc",
  tenantId: "tenant_raw_abc",
};

function expectTenantSafe(event: NonNullable<ReturnType<typeof adaptTenantNotificationToInboxEvent>>) {
  expect(event.audienceRole).toBe("tenant");
  expect(event.rawIdsIncluded).toBe(false);
  expect(event.tokensIncluded).toBe(false);
  expect(event.secretsIncluded).toBe(false);
  expect(event.providerPayloadIncluded).toBe(false);
  expect(event.storagePathIncluded).toBe(false);
  expect(event.privateNotesIncluded).toBe(false);
  expect(event.id).toMatch(/^inbox_v1_/);
  expect(event.sourceId).toMatch(/^inbox_v1_/);
  expect(event.audienceScopeKey).toMatch(/^scope_v1_/);
  expect(JSON.stringify(event)).not.toContain("tenant_workspace_raw_abc");
  expect(JSON.stringify(event)).not.toContain("tenant_raw_abc");
}

describe("tenant inbox adapters", () => {
  it("projects tenant notifications into safe inbox events", () => {
    const event = adaptTenantNotificationToInboxEvent(
      {
        id: "notification_raw_123",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        sourceKind: "tenant.notice",
        title: "Notice available",
        summary: "A notice is ready to review.",
        priority: "high",
        createdAt: "2026-06-09T10:00:00.000Z",
      },
      tenantContext
    );

    expect(event).toMatchObject({
      sourceKind: "tenant.notice",
      title: "Notice available",
      body: "A notice is ready to review.",
      priority: "high",
      status: "unread",
      occurredAt: "2026-06-09T10:00:00.000Z",
    });
    expectTenantSafe(event!);
    expect(JSON.stringify(event)).not.toContain("notification_raw_123");
  });

  it("preserves viewing notification source kind in safe tenant projections", () => {
    const event = adaptTenantNotificationToInboxEvent(
      {
        id: "viewing_notification_raw_123",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        sourceKind: "tenant.viewing",
        title: "Viewing cancelled",
        summary: "Your viewing has been cancelled.",
        priority: "high",
        createdAt: "2026-06-09T10:00:00.000Z",
      },
      tenantContext
    );

    expect(event).toMatchObject({
      sourceKind: "tenant.viewing",
      title: "Viewing cancelled",
      body: "Your viewing has been cancelled.",
      priority: "high",
    });
    expectTenantSafe(event!);
    expect(JSON.stringify(event)).not.toContain("viewing_notification_raw_123");
  });

  it("rejects cross-tenant and sensitive tenant records", () => {
    expect(
      adaptTenantNotificationToInboxEvent(
        {
          id: "notification_raw_123",
          tenantWorkspaceId: "tenant_workspace_other",
          title: "Other tenant notification",
        },
        tenantContext
      )
    ).toBeNull();

    expect(
      adaptTenantMessageToInboxEvent(
        {
          id: "message_raw_123",
          tenantWorkspaceId: "tenant_workspace_raw_abc",
          body: "Tenant-safe body",
          landlordNotes: "internal landlord note",
        },
        tenantContext
      )
    ).toBeNull();

    expect(
      adaptTenantMessageToInboxEvent(
        {
          id: "message_raw_124",
          tenantWorkspaceId: "tenant_workspace_raw_abc",
          body: "File at gs://bucket/private.pdf",
        },
        tenantContext
      )
    ).toBeNull();
  });

  it("adapts tenant maintenance and screening sources without source mutation", () => {
    const maintenance = {
      id: "maintenance_raw_123",
      tenantWorkspaceId: "tenant_workspace_raw_abc",
      title: "Kitchen sink",
      status: "urgent",
      updatedAt: "2026-06-09T11:00:00.000Z",
    };
    const screening = {
      id: "screening_raw_123",
      applicantTenantId: "tenant_raw_abc",
      status: "consent_pending",
      requestedAt: "2026-06-09T12:00:00.000Z",
    };
    const before = JSON.stringify({ maintenance, screening });

    const maintenanceEvent = adaptTenantMaintenanceToInboxEvent(maintenance, tenantContext);
    const screeningEvent = adaptTenantScreeningToInboxEvent(screening, tenantContext);

    expect(maintenanceEvent).toMatchObject({
      sourceKind: "tenant.maintenance",
      priority: "high",
      body: "Status: urgent",
    });
    expect(screeningEvent).toMatchObject({
      sourceKind: "tenant.screening",
      priority: "high",
      title: "Screening consent required",
    });
    expectTenantSafe(maintenanceEvent!);
    expectTenantSafe(screeningEvent!);
    expect(JSON.stringify({ maintenance, screening })).toBe(before);
  });

  it("adapts tenant viewing requests with lifecycle status mapping", () => {
    const scheduled = adaptTenantViewingRequestToInboxEvent(
      {
        id: "viewing_raw_123",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        status: "scheduled",
        selectedSlot: { startAt: "2026-06-10T18:00:00.000Z" },
        updatedAt: "2026-06-09T13:00:00.000Z",
      },
      tenantContext
    );
    const cancelled = adaptTenantViewingRequestToInboxEvent(
      {
        id: "viewing_raw_124",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        status: "cancelled",
        cancelledAt: "2026-06-09T14:00:00.000Z",
      },
      tenantContext
    );

    expect(scheduled).toMatchObject({
      sourceKind: "tenant.viewing",
      title: "Viewing scheduled",
      priority: "normal",
      status: "unread",
    });
    expect(cancelled).toMatchObject({
      sourceKind: "tenant.viewing",
      title: "Viewing cancelled",
      priority: "normal",
      status: "archived",
    });
    expectTenantSafe(scheduled!);
    expectTenantSafe(cancelled!);
    expect(JSON.stringify([scheduled, cancelled])).not.toContain("viewing_raw_");
  });

  it("rejects tenant viewing requests outside scope or with sensitive fields", () => {
    expect(
      adaptTenantViewingRequestToInboxEvent(
        {
          id: "viewing_raw_123",
          tenantWorkspaceId: "other_workspace",
          status: "scheduled",
        },
        tenantContext
      )
    ).toBeNull();
    expect(
      adaptTenantViewingRequestToInboxEvent(
        {
          id: "viewing_raw_124",
          tenantWorkspaceId: "tenant_workspace_raw_abc",
          status: "scheduled",
          landlordNotes: "internal",
        },
        tenantContext
      )
    ).toBeNull();
  });

  it("adapts tenant lease notices and application statuses safely", () => {
    const notice = adaptTenantLeaseNoticeToInboxEvent(
      {
        id: "notice_raw_123",
        tenantId: "tenant_raw_abc",
        noticeType: "renewal_offer",
        status: "served",
        deadline: "2026-06-30T12:00:00.000Z",
        servedAt: "2026-06-09T12:00:00.000Z",
      },
      tenantContext
    );
    const application = adaptTenantApplicationStatusToInboxEvent(
      {
        id: "application_raw_123",
        applicantTenantId: "tenant_raw_abc",
        status: "pending_documents",
        nextAction: "Upload requested documents.",
        updatedAt: "2026-06-09T13:00:00.000Z",
      },
      tenantContext
    );

    expect(notice).toMatchObject({
      sourceKind: "tenant.notice",
      title: "Lease notice served",
      priority: "high",
      status: "unread",
    });
    expect(application).toMatchObject({
      sourceKind: "tenant.application",
      title: "Application action needed",
      priority: "high",
      status: "unread",
    });
    expectTenantSafe(notice!);
    expectTenantSafe(application!);
    expect(JSON.stringify([notice, application])).not.toContain("notice_raw_");
    expect(JSON.stringify([notice, application])).not.toContain("application_raw_");
  });

  it("rejects tenant notice and application records with unsafe internals", () => {
    expect(
      adaptTenantLeaseNoticeToInboxEvent(
        {
          id: "notice_raw_123",
          tenantId: "tenant_raw_abc",
          status: "served",
          adminEnforcementFlags: ["internal"],
        },
        tenantContext
      )
    ).toBeNull();
    expect(
      adaptTenantApplicationStatusToInboxEvent(
        {
          id: "application_raw_123",
          applicantTenantId: "tenant_raw_abc",
          status: "under_review",
          screeningReport: { raw: true },
        },
        tenantContext
      )
    ).toBeNull();
  });
});
