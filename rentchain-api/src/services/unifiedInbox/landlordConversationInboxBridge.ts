type LandlordConversationRecord = Record<string, unknown> & {
  id?: unknown;
  landlordId?: unknown;
  propertyId?: unknown;
  lastMessageAt?: unknown;
  lastReadAtLandlord?: unknown;
};

type MessageRecord = Record<string, unknown> & {
  id?: unknown;
  conversationId?: unknown;
  senderRole?: unknown;
  createdAt?: unknown;
  createdAtMs?: unknown;
};

function stringValue(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function millis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof (value as any).toMillis === "function") return (value as any).toMillis();
  if (value && typeof (value as any).seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function safeLabel(value: unknown, fallback: string, max = 120) {
  const next = stringValue(value, max);
  if (!next || /(gs:\/\/|storage\/|firestore|token|secret|-----BEGIN|rawId|adminNotes)/i.test(next)) return fallback;
  return next;
}

function boundedPreview(value: unknown) {
  const body = safeLabel(value, "You have a new tenant message.", 280);
  return body.length >= 280 ? `${body.slice(0, 277)}...` : body;
}

function latestTenantMessage(messages: MessageRecord[]) {
  return messages
    .filter((message) => stringValue(message.senderRole, 40).toLowerCase() === "tenant")
    .map((message) => ({ message, at: millis(message.createdAt ?? message.createdAtMs) }))
    .filter((entry): entry is { message: MessageRecord; at: number } => entry.at != null)
    .sort((left, right) => right.at - left.at)[0] || null;
}

/**
 * Builds adapter-ready message records from landlord-authoritative conversations.
 * Child messages never establish ownership and one conversation emits at most one item.
 */
export function buildLandlordConversationInboxRecords(params: {
  landlordId: string;
  propertyId?: string | null;
  conversations: LandlordConversationRecord[];
  messages: MessageRecord[];
}) {
  const landlordId = stringValue(params.landlordId);
  const propertyId = stringValue(params.propertyId);
  if (!landlordId) return [];

  const messagesByConversation = new Map<string, MessageRecord[]>();
  for (const message of params.messages) {
    const conversationId = stringValue(message.conversationId);
    if (!conversationId) continue;
    const current = messagesByConversation.get(conversationId) || [];
    current.push(message);
    messagesByConversation.set(conversationId, current);
  }

  return params.conversations.flatMap((conversation) => {
    const conversationId = stringValue(conversation.id);
    if (!conversationId || stringValue(conversation.landlordId) !== landlordId) return [];
    if (propertyId && stringValue(conversation.propertyId) !== propertyId) return [];

    const latest = latestTenantMessage(messagesByConversation.get(conversationId) || []);
    if (!latest) return [];

    const lastMessageAt = millis(conversation.lastMessageAt) ?? latest.at;
    const lastReadAt = millis(conversation.lastReadAtLandlord);
    const unread = lastReadAt == null || lastMessageAt > lastReadAt;
    const tenantName = safeLabel(
      conversation.tenantDisplayName || conversation.tenantName || conversation.tenantSnapshotLabel,
      "Tenant"
    );
    const propertyLabel = safeLabel(
      conversation.propertyDisplayLabel || conversation.propertyName || conversation.propertySnapshotLabel,
      ""
    );
    const unitLabel = safeLabel(
      conversation.unitDisplayLabel || conversation.unitLabel || conversation.unitSnapshotLabel,
      ""
    );
    const context = [propertyLabel, unitLabel].filter(Boolean).join(" · ");
    const preview = boundedPreview(latest.message.body || latest.message.text || latest.message.summary);

    return [{
      id: conversationId,
      conversationId,
      landlordId,
      propertyId: stringValue(conversation.propertyId),
      senderRole: "tenant",
      title: `Message from ${tenantName}`,
      body: context ? `${context} — ${preview}` : preview,
      priority: "normal",
      status: unread ? "unread" : "read",
      readAt: unread || lastReadAt == null ? null : new Date(lastReadAt).toISOString(),
      createdAt: new Date(latest.at).toISOString(),
    }];
  });
}
