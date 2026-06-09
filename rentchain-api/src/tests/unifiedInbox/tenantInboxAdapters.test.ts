import { describe, expect, it } from "vitest";
import {
  adaptTenantMaintenanceToInboxEvent,
  adaptTenantMessageToInboxEvent,
  adaptTenantNotificationToInboxEvent,
  adaptTenantScreeningToInboxEvent,
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
});
