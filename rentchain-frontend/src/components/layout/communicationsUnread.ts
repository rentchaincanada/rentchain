import { fetchLandlordConversations, type Conversation } from "../../api/messagesApi";
import {
  fetchUnifiedInbox,
  type UnifiedInboxRecord,
} from "../../api/unifiedInboxApi";

export type CommunicationsUnreadState = {
  messages: boolean;
  inbox: boolean;
};

export const EMPTY_COMMUNICATIONS_UNREAD: CommunicationsUnreadState = {
  messages: false,
  inbox: false,
};

export function deriveCommunicationsUnreadState(
  conversations: Conversation[],
  inboxRecords: UnifiedInboxRecord[]
): CommunicationsUnreadState {
  return {
    messages: conversations.some(
      (conversation) =>
        conversation.hasUnread === true ||
        Number((conversation as Conversation & { unreadCount?: number }).unreadCount || 0) > 0
    ),
    inbox: inboxRecords.some(
      (record) => record.status === "unread" && record.sourceKind !== "landlord.message"
    ),
  };
}

export async function loadCommunicationsUnreadState(
  includeMessages: boolean
): Promise<CommunicationsUnreadState> {
  const [conversationsResult, inboxResult] = await Promise.allSettled([
    includeMessages ? fetchLandlordConversations() : Promise.resolve([]),
    fetchUnifiedInbox("landlord"),
  ]);

  const conversations = conversationsResult.status === "fulfilled" ? conversationsResult.value : [];
  const response = inboxResult.status === "fulfilled" ? inboxResult.value : null;
  const inboxRecords = response?.records?.length ? response.records : response?.items || [];

  return deriveCommunicationsUnreadState(conversations, inboxRecords);
}
