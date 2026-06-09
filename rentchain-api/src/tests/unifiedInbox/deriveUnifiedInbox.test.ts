import { describe, expect, it } from "vitest";
import {
  deriveContractorUnifiedInbox,
  deriveLandlordUnifiedInbox,
  deriveTenantUnifiedInbox,
  encodeUnifiedInboxCursor,
  sortUnifiedInboxEvents,
} from "../../services/unifiedInbox";
import type { UnifiedInboxEvent } from "../../services/unifiedInbox";

function event(overrides: Partial<UnifiedInboxEvent>): UnifiedInboxEvent {
  return {
    id: "inbox_v1_default",
    sourceKind: "tenant.message",
    sourceId: "inbox_v1_source",
    audienceRole: "tenant",
    audienceScopeKey: "scope_v1_default",
    title: "Title",
    body: "Body",
    priority: "normal",
    status: "unread",
    occurredAt: "2026-06-09T10:00:00.000Z",
    readAt: null,
    sourceRef: { kind: "tenant.message", ref: "inbox_v1_source" },
    rawIdsIncluded: false,
    tokensIncluded: false,
    secretsIncluded: false,
    providerPayloadIncluded: false,
    storagePathIncluded: false,
    privateNotesIncluded: false,
    ...overrides,
  };
}

describe("derive unified inbox", () => {
  it("sorts unread events before read events, then priority and recency", () => {
    const sorted = sortUnifiedInboxEvents([
      event({ id: "inbox_v1_read_critical", priority: "critical", status: "read", readAt: "2026-06-09T14:00:00.000Z" }),
      event({ id: "inbox_v1_unread_normal_new", priority: "normal", occurredAt: "2026-06-09T15:00:00.000Z" }),
      event({ id: "inbox_v1_unread_high_old", priority: "high", occurredAt: "2026-06-09T09:00:00.000Z" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "inbox_v1_unread_high_old",
      "inbox_v1_unread_normal_new",
      "inbox_v1_read_critical",
    ]);
  });

  it("derives tenant events from scoped sources only and paginates by safe cursor", async () => {
    const context = {
      tenantWorkspaceId: "tenant_workspace_raw_abc",
      tenantId: "tenant_raw_abc",
    };
    const notifications = [
      {
        id: "notification_raw_1",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        title: "Normal update",
        summary: "Ready",
        priority: "normal",
        createdAt: "2026-06-09T10:00:00.000Z",
      },
      {
        id: "notification_raw_2",
        tenantWorkspaceId: "tenant_workspace_raw_abc",
        title: "High update",
        summary: "Ready",
        priority: "high",
        createdAt: "2026-06-09T09:00:00.000Z",
      },
      {
        id: "notification_raw_3",
        tenantWorkspaceId: "other_workspace",
        title: "Other update",
      },
    ];

    const firstPage = await deriveTenantUnifiedInbox(context, { notifications, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].title).toBe("High update");
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.nextCursor).not.toContain("notification_raw_2");

    const secondPage = await deriveTenantUnifiedInbox(context, {
      notifications,
      limit: 5,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].title).toBe("Normal update");
    expect(JSON.stringify([...firstPage.items, ...secondPage.items])).not.toContain("tenant_workspace_raw_abc");
    expect(JSON.stringify([...firstPage.items, ...secondPage.items])).not.toContain("notification_raw_");
  });

  it("derives landlord events from scoped sources only", async () => {
    const page = await deriveLandlordUnifiedInbox("landlord_raw_abc", {
      applicationItems: [
        {
          id: "application_raw_1",
          landlordId: "landlord_raw_abc",
          title: "Application ready",
          summary: "Review needed",
          priority: "high",
          occurredAt: "2026-06-09T10:00:00.000Z",
        },
        {
          id: "application_raw_2",
          landlordId: "landlord_other",
          title: "Other application",
          summary: "Should not project",
        },
      ],
      leaseItems: [
        {
          id: "lease_raw_1",
          landlordId: "landlord_raw_abc",
          title: "Lease ready",
          state: "pending",
          occurredAt: "2026-06-09T11:00:00.000Z",
        },
      ],
    });

    expect(page.items.map((item) => item.title)).toEqual(["Application ready", "Lease ready"]);
    expect(JSON.stringify(page.items)).not.toContain("landlord_raw_abc");
    expect(JSON.stringify(page.items)).not.toContain("application_raw_");
    expect(JSON.stringify(page.items)).not.toContain("lease_raw_");
  });

  it("returns empty pages for missing scope and ignores invalid cursors", async () => {
    await expect(deriveTenantUnifiedInbox({ tenantWorkspaceId: "" })).resolves.toEqual({ items: [] });
    await expect(deriveLandlordUnifiedInbox("")).resolves.toEqual({ items: [] });

    const page = await deriveTenantUnifiedInbox(
      { tenantWorkspaceId: "tenant_workspace_raw_abc" },
      {
        notifications: [
          {
            id: "notification_raw_1",
            tenantWorkspaceId: "tenant_workspace_raw_abc",
            title: "Update",
          },
        ],
        cursor: encodeUnifiedInboxCursor(event({ id: "inbox_v1_missing" })),
      }
    );

    expect(page.items).toHaveLength(1);
  });

  it("derives tenant mixed source events for viewing, notices, and application status", async () => {
    const context = {
      tenantWorkspaceId: "tenant_workspace_raw_abc",
      tenantId: "tenant_raw_abc",
    };
    const page = await deriveTenantUnifiedInbox(context, {
      viewingRequests: [
        {
          id: "viewing_raw_1",
          tenantWorkspaceId: "tenant_workspace_raw_abc",
          status: "scheduled",
          selectedSlot: { startAt: "2026-06-09T15:00:00.000Z" },
          updatedAt: "2026-06-09T15:00:00.000Z",
        },
      ],
      notices: [
        {
          id: "notice_raw_1",
          tenantId: "tenant_raw_abc",
          noticeType: "renewal_offer",
          status: "served",
          servedAt: "2026-06-09T14:00:00.000Z",
        },
      ],
      applicationStatusItems: [
        {
          id: "application_raw_1",
          applicantTenantId: "tenant_raw_abc",
          status: "pending_documents",
          nextAction: "Upload documents.",
          updatedAt: "2026-06-09T13:00:00.000Z",
        },
      ],
      limit: 2,
    });

    expect(page.items.map((item) => item.sourceKind)).toEqual(["tenant.notice", "tenant.application"]);
    expect(page.nextCursor).toBeTruthy();
    expect(JSON.stringify(page.items)).not.toContain("tenant_raw_abc");
    expect(JSON.stringify(page.items)).not.toContain("_raw_");

    const secondPage = await deriveTenantUnifiedInbox(context, {
      viewingRequests: [
        {
          id: "viewing_raw_1",
          tenantWorkspaceId: "tenant_workspace_raw_abc",
          status: "scheduled",
          selectedSlot: { startAt: "2026-06-09T15:00:00.000Z" },
          updatedAt: "2026-06-09T15:00:00.000Z",
        },
      ],
      notices: [
        {
          id: "notice_raw_1",
          tenantId: "tenant_raw_abc",
          noticeType: "renewal_offer",
          status: "served",
          servedAt: "2026-06-09T14:00:00.000Z",
        },
      ],
      applicationStatusItems: [
        {
          id: "application_raw_1",
          applicantTenantId: "tenant_raw_abc",
          status: "pending_documents",
          nextAction: "Upload documents.",
          updatedAt: "2026-06-09T13:00:00.000Z",
        },
      ],
      limit: 2,
      cursor: page.nextCursor,
    });

    expect(secondPage.items.map((item) => item.sourceKind)).toEqual(["tenant.viewing"]);
  });

  it("derives landlord mixed source events for viewing, work order, notice, and application status", async () => {
    const page = await deriveLandlordUnifiedInbox("landlord_raw_abc", {
      viewingRequests: [
        {
          id: "viewing_raw_1",
          landlordId: "landlord_raw_abc",
          applicantName: "Jordan Lee",
          status: "slots_proposed",
          updatedAt: "2026-06-09T14:00:00.000Z",
        },
      ],
      workOrders: [
        {
          id: "work_order_raw_1",
          landlordId: "landlord_raw_abc",
          category: "plumbing",
          status: "overdue",
          updatedAt: "2026-06-09T13:00:00.000Z",
        },
      ],
      notices: [
        {
          id: "notice_raw_1",
          landlordId: "landlord_raw_abc",
          tenantName: "Jordan Lee",
          noticeType: "renewal_offer",
          status: "served",
          servedAt: "2026-06-09T12:00:00.000Z",
        },
      ],
      applicationStatusItems: [
        {
          id: "application_raw_1",
          landlordId: "landlord_raw_abc",
          applicantName: "Jordan Lee",
          status: "requires_decision",
          updatedAt: "2026-06-09T11:00:00.000Z",
        },
      ],
    });

    expect(page.items.map((item) => item.sourceKind)).toEqual([
      "landlord.viewing",
      "landlord.work_order",
      "landlord.application",
      "landlord.notice",
    ]);
    expect(JSON.stringify(page.items)).not.toContain("landlord_raw_abc");
    expect(JSON.stringify(page.items)).not.toContain("_raw_");
  });

  it("derives contractor work order communications separately from work orders", async () => {
    const page = await deriveContractorUnifiedInbox("contractor_raw_abc", {
      workOrders: [
        {
          id: "work_order_raw_1",
          assignedContractorId: "contractor_raw_abc",
          title: "Repair sink",
          status: "assigned",
          updatedAt: "2026-06-09T13:00:00.000Z",
        },
      ],
      workOrderCommunications: [
        {
          id: "communication_raw_1",
          contractorId: "contractor_raw_abc",
          text: "Deadline approaching.",
          createdAt: "2026-06-09T14:00:00.000Z",
        },
      ],
    });

    expect(page.items.map((item) => item.title)).toEqual([
      "Work order message from property manager",
      "Repair sink",
    ]);
    expect(JSON.stringify(page.items)).not.toContain("contractor_raw_abc");
    expect(JSON.stringify(page.items)).not.toContain("_raw_");
  });
});
