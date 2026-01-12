import { apiFetch } from "@/lib/apiClient";

export type Conversation = {
  id: string;
  landlordId?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  lastMessageAt?: number | null;
  createdAt?: number | null;
  hasUnread?: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  senderRole: "landlord" | "tenant";
  body: string;
  createdAt?: string | null;
  createdAtMs?: number | null;
};

export async function fetchLandlordConversations(): Promise<Conversation[]> {
  const res = await apiFetch("/landlord/messages/conversations");
  return Array.isArray((res as any)?.conversations) ? (res as any).conversations : [];
}

export async function fetchLandlordConversationMessages(
  id: string,
  limit = 50
): Promise<{ conversation: Conversation | null; messages: Message[] }> {
  const res = await apiFetch(`/landlord/messages/conversations/${encodeURIComponent(id)}?limit=${limit}`);
  return {
    conversation: (res as any)?.conversation ?? null,
    messages: Array.isArray((res as any)?.messages) ? (res as any).messages : [],
  };
}

export async function sendLandlordMessage(conversationId: string, body: string): Promise<Message> {
  const res = await apiFetch(`/landlord/messages/conversations/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return (res as any)?.message as Message;
}

export async function markLandlordConversationRead(conversationId: string): Promise<void> {
  await apiFetch(`/landlord/messages/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}

// Tenant endpoints
export async function ensureTenantConversation(): Promise<{ conversation: Conversation }> {
  const res = await apiFetch(`/tenant/messages/conversation`);
  return { conversation: (res as any)?.conversation };
}

export async function fetchTenantConversationMessages(
  id: string,
  limit = 50
): Promise<{ conversation: Conversation | null; messages: Message[] }> {
  const res = await apiFetch(`/tenant/messages/conversation/${encodeURIComponent(id)}?limit=${limit}`);
  return {
    conversation: (res as any)?.conversation ?? null,
    messages: Array.isArray((res as any)?.messages) ? (res as any).messages : [],
  };
}

export async function sendTenantMessage(conversationId: string, body: string): Promise<Message> {
  const res = await apiFetch(`/tenant/messages/conversation/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return (res as any)?.message as Message;
}

export async function markTenantConversationRead(conversationId: string): Promise<void> {
  await apiFetch(`/tenant/messages/conversation/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}
