import { describe, expect, it } from "vitest";
import { buildLandlordConversationInboxRecords } from "./landlordConversationInboxBridge";

describe("landlord conversation inbox bridge", () => {
  it("projects one latest tenant message per landlord-owned conversation without child ownership fields", () => {
    const records = buildLandlordConversationInboxRecords({
      landlordId: "landlord-1",
      conversations: [{
        id: "conversation-1",
        landlordId: "landlord-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
        lastMessageAt: "2026-07-20T10:02:00.000Z",
        lastReadAtLandlord: "2026-07-20T10:00:00.000Z",
      }],
      messages: [
        { id: "message-1", conversationId: "conversation-1", senderRole: "tenant", body: "First", createdAt: "2026-07-20T10:01:00.000Z" },
        { id: "message-2", conversationId: "conversation-1", senderRole: "tenant", body: "Latest question", createdAt: "2026-07-20T10:02:00.000Z" },
      ],
    });

    expect(records).toEqual([expect.objectContaining({
      id: "conversation-1",
      conversationId: "conversation-1",
      landlordId: "landlord-1",
      title: "Message from Taylor Tenant",
      body: "Harbour View · Unit 2A — Latest question",
      priority: "normal",
      status: "unread",
      readAt: null,
    })]);
  });

  it("fails closed across landlord and property scope and ignores landlord-authored messages", () => {
    const conversations = [
      { id: "owned", landlordId: "landlord-1", propertyId: "property-1", lastMessageAt: 2000 },
      { id: "other", landlordId: "landlord-2", propertyId: "property-1", lastMessageAt: 2000 },
      { id: "other-property", landlordId: "landlord-1", propertyId: "property-2", lastMessageAt: 2000 },
    ];
    const messages = [
      { conversationId: "owned", senderRole: "landlord", body: "Landlord reply", createdAtMs: 2000 },
      { conversationId: "other", senderRole: "tenant", body: "Private", createdAtMs: 2000 },
      { conversationId: "other-property", senderRole: "tenant", body: "Other property", createdAtMs: 2000 },
    ];

    expect(buildLandlordConversationInboxRecords({ landlordId: "landlord-1", propertyId: "property-1", conversations, messages })).toEqual([]);
  });

  it("projects canonical conversation read state and neutral safe labels", () => {
    const records = buildLandlordConversationInboxRecords({
      landlordId: "landlord-1",
      conversations: [{
        id: "conversation-1",
        landlordId: "landlord-1",
        tenantName: "gs://unsafe",
        propertyName: "firestore/path",
        lastMessageAt: 1000,
        lastReadAtLandlord: 2000,
      }],
      messages: [{ conversationId: "conversation-1", senderRole: "tenant", body: "Hello", createdAtMs: 1000 }],
    });

    expect(records[0]).toMatchObject({
      title: "Message from Tenant",
      body: "Hello",
      status: "read",
      readAt: "1970-01-01T00:00:02.000Z",
    });
  });
});
