import { describe, expect, it } from "vitest";
import { buildTenantCommunicationsWorkspaceState } from "./tenantCommunicationsWorkspaceState";

describe("tenantCommunicationsWorkspaceState", () => {
  it("shows empty inbox when no thread messages are visible", () => {
    const view = buildTenantCommunicationsWorkspaceState({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        propertyId: "prop-1",
        unitId: "unit-1",
        unreadCount: 0,
        lastMessageAt: null,
        messages: [],
      },
    });

    expect(view.inboxState).toBe("empty_inbox");
    expect(view.title).toMatch(/inbox is ready/i);
  });

  it("shows needs reply when the latest unread message is from the landlord", () => {
    const view = buildTenantCommunicationsWorkspaceState({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        propertyId: "prop-1",
        unitId: "unit-1",
        unreadCount: 1,
        lastMessageAt: "2026-04-01T00:00:00.000Z",
        messages: [
          {
            id: "msg-1",
            senderRole: "tenant",
            body: "Hello",
            createdAt: "2026-03-31T00:00:00.000Z",
            createdAtMs: 1,
          },
          {
            id: "msg-2",
            senderRole: "landlord",
            body: "Please confirm your move-in details.",
            createdAt: "2026-04-01T00:00:00.000Z",
            createdAtMs: 2,
          },
        ],
      },
    });

    expect(view.inboxState).toBe("needs_reply");
    expect(view.threadSummaries[0]?.needsReply).toBe(true);
  });

  it("shows informational only when messages are visible but sending is disabled", () => {
    const view = buildTenantCommunicationsWorkspaceState({
      canSend: false,
      canSendReason: "Messaging is not available from this workspace yet.",
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        propertyId: "prop-1",
        unitId: "unit-1",
        unreadCount: 0,
        lastMessageAt: "2026-04-01T00:00:00.000Z",
        messages: [
          {
            id: "msg-1",
            senderRole: "landlord",
            body: "Lease details have been shared.",
            createdAt: "2026-04-01T00:00:00.000Z",
            createdAtMs: 2,
          },
        ],
      },
    });

    expect(view.inboxState).toBe("informational_only");
    expect(view.description).toMatch(/not available/i);
  });

  it("shows active threads when the conversation is up to date", () => {
    const view = buildTenantCommunicationsWorkspaceState({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        propertyId: "prop-1",
        unitId: "unit-1",
        unreadCount: 0,
        lastMessageAt: "2026-04-01T00:00:00.000Z",
        messages: [
          {
            id: "msg-1",
            senderRole: "landlord",
            body: "Thanks for confirming.",
            createdAt: "2026-04-01T00:00:00.000Z",
            createdAtMs: 2,
          },
        ],
      },
    });

    expect(view.inboxState).toBe("active_threads");
    expect(view.label).toMatch(/active threads/i);
  });
});
