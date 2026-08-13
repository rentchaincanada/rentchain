import { describe, expect, it, vi } from "vitest";
import { deriveCommunicationsUnreadState } from "./communicationsUnread";

vi.mock("../../api/messagesApi", () => ({
  fetchLandlordConversations: vi.fn(),
}));

vi.mock("../../api/unifiedInboxApi", () => ({
  fetchUnifiedInbox: vi.fn(),
}));

describe("deriveCommunicationsUnreadState", () => {
  it("returns neither when all real sources are read", () => {
    expect(
      deriveCommunicationsUnreadState(
        [{ id: "conversation-1", hasUnread: false }],
        [{
          id: "inbox-1",
          sourceKind: "landlord.maintenance",
          audienceRole: "landlord",
          title: "Maintenance update",
          body: "Update",
          priority: "normal",
          status: "read",
          occurredAt: "2026-08-12T00:00:00.000Z",
          readAt: "2026-08-12T01:00:00.000Z",
        }]
      )
    ).toEqual({ messages: false, inbox: false });
  });

  it("derives both independent sources while assigning shared message events only to Messages", () => {
    expect(
      deriveCommunicationsUnreadState(
        [{ id: "conversation-1", hasUnread: true }],
        [
          {
            id: "conversation-1",
            sourceKind: "landlord.message",
            audienceRole: "landlord",
            title: "Message",
            body: "Message",
            priority: "normal",
            status: "unread",
            occurredAt: "2026-08-12T00:00:00.000Z",
            readAt: null,
          },
          {
            id: "inbox-1",
            sourceKind: "landlord.lease",
            audienceRole: "landlord",
            title: "Lease update",
            body: "Update",
            priority: "normal",
            status: "unread",
            occurredAt: "2026-08-12T00:00:00.000Z",
            readAt: null,
          },
        ]
      )
    ).toEqual({ messages: true, inbox: true });
  });

  it("never derives Notices state from navigation symmetry", () => {
    expect(
      deriveCommunicationsUnreadState([], [{
        id: "notice-1",
        sourceKind: "landlord.notice",
        audienceRole: "landlord",
        title: "Notice",
        body: "Notice",
        priority: "normal",
        status: "read",
        occurredAt: "2026-08-12T00:00:00.000Z",
        readAt: "2026-08-12T01:00:00.000Z",
      }])
    ).toEqual({ messages: false, inbox: false });
  });
});
