import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchLandlordConversations,
  fetchLandlordConversationMessages,
  sendLandlordMessage,
  markLandlordConversationRead,
  type Conversation,
  type Message,
} from "@/api/messagesApi";
import { spacing, colors, text, radius } from "@/styles/tokens";
import { ResponsiveMasterDetail } from "@/components/layout/ResponsiveMasterDetail";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUpgrade } from "@/context/UpgradeContext";
import { upgradeStarterButtonStyle } from "@/lib/upgradeButtonStyles";
import "./MessagesPage.css";

const POLL_CONVERSATIONS_MS = 15000;
const POLL_THREAD_MS = 12000;
const MAX_CONVERSATIONS_BACKOFF_MS = 120000;

function areConversationsEquivalent(current: Conversation[], next: Conversation[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  return current.every((item, index) => {
    const candidate = next[index];
    return (
      item.id === candidate?.id &&
      item.tenantDisplayName === candidate?.tenantDisplayName &&
      item.propertyDisplayLabel === candidate?.propertyDisplayLabel &&
      item.unitDisplayLabel === candidate?.unitDisplayLabel &&
      item.lastMessageAt === candidate?.lastMessageAt &&
      item.hasUnread === candidate?.hasUnread
    );
  });
}

function areMessagesEquivalent(current: Message[], next: Message[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  return current.every((item, index) => {
    const candidate = next[index];
    return (
      item.id === candidate?.id &&
      item.body === candidate?.body &&
      item.senderRole === candidate?.senderRole &&
      item.createdAtMs === candidate?.createdAtMs
    );
  });
}

function displayTenantName(conversation: Conversation | null) {
  const tenantName = String(conversation?.tenantDisplayName || "").trim();
  return tenantName || "Tenant name unavailable";
}

function hasTenantDisplayName(conversation: Conversation | null) {
  return Boolean(String(conversation?.tenantDisplayName || "").trim());
}

function displayUnitContext(conversation: Conversation | null) {
  const unitLabel = String(conversation?.unitDisplayLabel || "").trim();
  if (!unitLabel) return "";
  return /^unit\b/i.test(unitLabel) ? unitLabel : `Unit ${unitLabel}`;
}

function displayConversationContext(conversation: Conversation | null) {
  const propertyLabel = String(conversation?.propertyDisplayLabel || "").trim();
  const unitLabel = displayUnitContext(conversation);
  if (propertyLabel && unitLabel) return `${propertyLabel} / ${unitLabel}`;
  if (unitLabel) return unitLabel;
  if (propertyLabel) return propertyLabel;
  return "Conversation";
}

function buildTenantInitials(conversation: Conversation | null) {
  const tenantName = displayTenantName(conversation);
  const parts = tenantName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || tenantName === "Tenant name unavailable") return "T";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function buildConversationTitle(conversation: Conversation | null) {
  if (!conversation) return "Conversation";
  const tenantName = displayTenantName(conversation);
  const locationLabel = displayConversationContext(conversation);
  if (!hasTenantDisplayName(conversation)) return `${tenantName} • ${locationLabel}`;
  if (tenantName && locationLabel) return `${tenantName} • ${locationLabel}`;
  if (tenantName) return tenantName;
  if (locationLabel) return locationLabel;
  return "Conversation";
}

function buildConversationMeta(conversation: Conversation) {
  return displayConversationContext(conversation);
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { features, loading: capsLoading } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const messagingEnabled = features?.messaging !== false;
  const conversationPollTimeoutRef = useRef<number | null>(null);
  const conversationPollFailureRef = useRef(0);
  const hasLoadedConversationsRef = useRef(false);
  const hasLoadedThreadRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const lastMarkedReadRef = useRef<Record<string, number>>({});

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadConversations = useCallback(async (
    preferredId?: string | null,
    options?: { background?: boolean }
  ): Promise<boolean> => {
    const background = options?.background === true;
    try {
      if (!background || !hasLoadedConversationsRef.current) {
        setLoadingList(true);
      }
      const data = await fetchLandlordConversations();
      setConversations((prev) => (areConversationsEquivalent(prev, data) ? prev : data));
      hasLoadedConversationsRef.current = true;

      const currentSelectedId = selectedIdRef.current;
      const preferredSelectedId =
        preferredId && data.some((conversation) => conversation.id === preferredId)
          ? preferredId
          : null;
      const existingSelectedId =
        currentSelectedId && data.some((conversation) => conversation.id === currentSelectedId)
          ? currentSelectedId
          : null;
      const nextSelectedId =
        preferredSelectedId || existingSelectedId || data[0]?.id || null;

      if (nextSelectedId !== currentSelectedId) {
        selectedIdRef.current = nextSelectedId;
        setSelectedId(nextSelectedId);
      }
      setError(null);
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to load conversations");
      return false;
    } finally {
      if (!background) {
        setLoadingList(false);
      }
    }
  }, []);

  const loadThread = useCallback(async (id: string, options?: { background?: boolean }) => {
    const background = options?.background === true;
    try {
      if (!background || !hasLoadedThreadRef.current) {
        setLoadingThread(true);
      }
      const res = await fetchLandlordConversationMessages(id);
      const nextMessages = Array.isArray(res.messages) ? res.messages : [];
      setMessages((prev) => (areMessagesEquivalent(prev, nextMessages) ? prev : nextMessages));
      if (res.conversation) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === res.conversation?.id ? { ...conversation, ...res.conversation } : conversation
          )
        );
      }
      hasLoadedThreadRef.current = true;
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load messages");
    } finally {
      if (!background) {
        setLoadingThread(false);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deepLinkId = params.get("threadId") || params.get("c");
    void (async () => {
      if (!messagingEnabled) return;
      await loadConversations(deepLinkId);
    })();
  }, [location.search, messagingEnabled, loadConversations]);

  useEffect(() => {
    if (!messagingEnabled) return;
    let cancelled = false;

    const scheduleNext = () => {
      const attempts = conversationPollFailureRef.current;
      const delay = Math.min(
        POLL_CONVERSATIONS_MS * Math.pow(2, attempts),
        MAX_CONVERSATIONS_BACKOFF_MS
      );
      if (conversationPollTimeoutRef.current) {
        window.clearTimeout(conversationPollTimeoutRef.current);
      }
      conversationPollTimeoutRef.current = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const ok = await loadConversations(selectedIdRef.current, { background: true });
        conversationPollFailureRef.current = ok
          ? 0
          : Math.min(conversationPollFailureRef.current + 1, 6);
      } catch {
        conversationPollFailureRef.current = Math.min(conversationPollFailureRef.current + 1, 6);
      } finally {
        if (!cancelled) scheduleNext();
      }
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (conversationPollTimeoutRef.current) {
        window.clearTimeout(conversationPollTimeoutRef.current);
        conversationPollTimeoutRef.current = null;
      }
    };
  }, [messagingEnabled, loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    if (!messagingEnabled) return;
    hasLoadedThreadRef.current = false;
    void loadThread(selectedId);
    const t = window.setInterval(() => void loadThread(selectedId, { background: true }), POLL_THREAD_MS);
    return () => window.clearInterval(t);
  }, [selectedId, messagingEnabled, loadThread]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (!messagingEnabled || !selectedConversation?.id || selectedConversation.hasUnread !== true) return;
    const marker = Number(selectedConversation.lastMessageAt || 0);
    if (lastMarkedReadRef.current[selectedConversation.id] === marker) return;

    let cancelled = false;
    void (async () => {
      lastMarkedReadRef.current[selectedConversation.id] = marker;
      try {
        await markLandlordConversationRead(selectedConversation.id);
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversation.id
              ? {
                  ...conversation,
                  hasUnread: false,
                }
              : conversation
          )
        );
      } catch (err: any) {
        delete lastMarkedReadRef.current[selectedConversation.id];
        if (!cancelled) {
          setError(err?.message || "Failed to mark conversation read");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    messagingEnabled,
    selectedConversation?.id,
    selectedConversation?.hasUnread,
    selectedConversation?.lastMessageAt,
  ]);


  const handleSend = async () => {
    if (!selectedId || !composer.trim()) return;
    const body = composer.trim();
    setComposer("");
    await sendLandlordMessage(selectedId, body);
    await loadThread(selectedId);
    await loadConversations(selectedId, { background: true });
  };
  const selectedConversationTitle = buildConversationTitle(selectedConversation);

  return (
    <div className="rc-messages-page">
      <h1 style={{ marginBottom: spacing.md }}>Messages</h1>
      {error && <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div>}
      {!capsLoading && !messagingEnabled ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: spacing.lg,
            background: colors.card,
            maxWidth: 640,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            Upgrade to manage your rentals
          </div>
          <div style={{ color: text.muted, fontSize: 14, marginBottom: 12 }}>
            RentChain Screening is free. Rental management starts on Starter.
          </div>
          <button
            type="button"
            onClick={() =>
              openUpgrade({
                reason: "screening",
                plan: "Screening",
                copy: {
                  title: "Upgrade to manage your rentals",
                  body: "RentChain Screening is free. Rental management starts on Starter.",
                },
                ctaLabel: "Upgrade to Starter",
              })
            }
            style={upgradeStarterButtonStyle}
          >
            Upgrade to Starter
          </button>
        </div>
      ) : (
      <div className="rc-messages-grid">
        <ResponsiveMasterDetail
          masterTitle="Conversations"
          hasSelection={Boolean(selectedId)}
          selectedLabel={selectedConversationTitle}
          onClearSelection={() => {
            setSelectedId(null);
            navigate("/messages");
          }}
          masterDropdown={
            conversations.length ? (
              <select
                value={selectedId || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setSelectedId(next);
                  navigate(`/messages?threadId=${next}`);
                }}
                className="rc-full-width-mobile"
              >
                <option value="">Select conversation</option>
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {buildConversationTitle(c)}
                  </option>
                ))}
              </select>
            ) : null
          }
          master={
            <div className="rc-messages-list">
              {loadingList ? (
                <div style={{ color: text.muted }}>Loading…</div>
              ) : conversations.length === 0 ? (
                <div style={{ color: text.muted }}>No conversations yet.</div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      className="rc-messages-list-item"
                      onClick={() => {
                        setSelectedId(c.id);
                        navigate(`/messages?threadId=${c.id}`);
                      }}
                      style={{
                        border: `1px solid ${isActive ? colors.accent : colors.border}`,
                        background: isActive ? colors.accentSoft : colors.panel,
                      }}
                    >
                      <div className="rc-messages-list-item-body">
                        <div
                          className="rc-messages-avatar"
                          aria-hidden="true"
                          title={displayTenantName(c)}
                        >
                          {buildTenantInitials(c)}
                        </div>
                        <div className="rc-messages-list-item-content">
                          <div className="rc-messages-list-item-row">
                            <div className="rc-messages-list-item-title">
                              {displayTenantName(c)}
                            </div>
                            {c.hasUnread ? (
                              <span className="rc-messages-unread-dot" />
                            ) : null}
                          </div>
                          <div className="rc-messages-list-item-meta">
                            {buildConversationMeta(c)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          }
          detail={
            <div className="rc-messages-thread">
              {selectedConversation ? (
                <>
                  <div className="rc-messages-thread-header">
                    <div className="rc-messages-thread-title">
                      {selectedConversationTitle}
                    </div>
                  </div>
                  <div className="rc-messages-thread-body">
                    {loadingThread ? (
                      <div style={{ color: text.muted }}>Loading messages…</div>
                    ) : messages.length === 0 ? (
                      <div style={{ color: text.muted }}>No messages yet.</div>
                    ) : (
                      messages
                        .slice()
                        .sort(
                          (a, b) =>
                            (a.createdAtMs || 0) - (b.createdAtMs || 0)
                        )
                        .map((m) => {
                          const isSender = m.senderRole === "landlord";
                          return (
                            <div
                              key={m.id}
                              className={`rc-messages-bubble ${isSender ? "is-sent" : "is-received"}`}
                              style={{
                                alignSelf: isSender ? "flex-end" : "flex-start",
                                background: isSender ? colors.accentSoft : colors.panel,
                                border: `1px solid ${colors.border}`,
                              }}
                            >
                              <div className="rc-messages-bubble-meta">
                                {m.senderRole} •{" "}
                                {m.createdAtMs ? new Date(m.createdAtMs).toLocaleString() : ""}
                              </div>
                              <div className="rc-messages-bubble-text">{m.body}</div>
                            </div>
                          );
                        })
                    )}
                  </div>
                  <div className="rc-messages-composer">
                    <textarea
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder="Write a message"
                      className="rc-messages-composer-input"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!composer.trim()}
                      className="rc-messages-composer-send"
                      style={{
                        background: colors.accent,
                        border: `1px solid ${colors.border}`,
                        cursor: composer.trim() ? "pointer" : "not-allowed",
                        opacity: composer.trim() ? 1 : 0.6,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color: text.muted }}>Select a conversation.</div>
              )}
            </div>
          }
        />
      </div>
      )}
    </div>
  );
}
