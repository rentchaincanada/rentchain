import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchLandlordConversations,
  fetchLandlordConversationMessages,
  sendLandlordMessage,
  markLandlordConversationRead,
  fetchLandlordMessageRecipients,
  createLandlordConversationMessage,
  type Conversation,
  type Message,
  type MessageRecipient,
} from "@/api/messagesApi";
import { spacing, colors, text } from "@/styles/tokens";
import { ResponsiveMasterDetail } from "@/components/layout/ResponsiveMasterDetail";
import { useCapabilities } from "@/hooks/useCapabilities";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { isUpgradeRequiredError } from "@/lib/gatedFeatureErrors";
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
  return tenantName || "Tenant";
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
  const propertyId = String(conversation?.propertyId || "").trim();
  const unitId = String(conversation?.unitId || "").trim();
  if (propertyId && unitId) return "Linked property / linked unit";
  if (unitId) return "Linked unit";
  if (propertyId) return "Linked property";
  return "Tenant conversation";
}

function buildTenantInitials(conversation: Conversation | null) {
  const tenantName = displayTenantName(conversation);
  const parts = tenantName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || tenantName === "Tenant") return "T";
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

function tenantProfilePath(conversation: Conversation | null) {
  const tenantId = String(conversation?.tenantId || "").trim();
  return tenantId ? `/tenants?tenantId=${encodeURIComponent(tenantId)}` : null;
}

function TenantNameLabel({
  conversation,
  className,
}: {
  conversation: Conversation | null;
  className?: string;
}) {
  const tenantName = displayTenantName(conversation);
  return <span className={className}>{tenantName}</span>;
}

function TenantProfileButton({
  conversation,
  onClick,
}: {
  conversation: Conversation | null;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const navigate = useNavigate();
  const path = tenantProfilePath(conversation);
  if (!path) return null;
  return (
    <button
      type="button"
      className="rc-messages-tenant-profile-button"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.stopPropagation();
        navigate(path);
      }}
    >
      Profile
    </button>
  );
}

function ConversationHeaderTitle({ conversation }: { conversation: Conversation | null }) {
  if (!conversation) return <>Conversation</>;
  const locationLabel = displayConversationContext(conversation);
  return (
    <span className="rc-messages-thread-title-content">
      <TenantNameLabel conversation={conversation} />
      {locationLabel ? <span> • {locationLabel}</span> : null}
      <TenantProfileButton conversation={conversation} />
    </span>
  );
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [submittingFirstMessage, setSubmittingFirstMessage] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { features, loading: capsLoading } = useCapabilities();
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
      setError(isUpgradeRequiredError(err) ? null : err?.message || "Failed to load conversations");
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
      setError(isUpgradeRequiredError(err) ? null : err?.message || "Failed to load messages");
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
          setError(isUpgradeRequiredError(err) ? null : err?.message || "Failed to mark conversation read");
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
  const recipientKey = (recipient: MessageRecipient) => `${recipient.leaseId}:${recipient.tenantId}`;
  const selectedRecipient = recipients.find((recipient) => recipientKey(recipient) === selectedRecipientKey) || null;
  const filteredRecipients = recipients.filter((recipient) =>
    [recipient.tenantDisplayName, recipient.propertyDisplayLabel, recipient.unitDisplayLabel]
      .map((value) => String(value || "").toLowerCase())
      .join(" ")
      .includes(recipientSearch.trim().toLowerCase())
  );

  const openCompose = async () => {
    setComposeOpen(true);
    setComposeError(null);
    setLoadingRecipients(true);
    try {
      setRecipients(await fetchLandlordMessageRecipients());
    } catch (err: any) {
      setComposeError(err?.message || "Failed to load eligible tenants");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const closeCompose = () => {
    if (submittingFirstMessage) return;
    setComposeOpen(false);
    setRecipientSearch("");
    setSelectedRecipientKey(null);
    setFirstMessage("");
    setComposeError(null);
  };

  const handleFirstMessage = async () => {
    const body = firstMessage.trim();
    if (!selectedRecipient || !body || submittingFirstMessage) return;
    setSubmittingFirstMessage(true);
    setComposeError(null);
    try {
      const requestId = globalThis.crypto?.randomUUID?.() || `compose-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await createLandlordConversationMessage({
        tenantId: selectedRecipient.tenantId,
        leaseId: selectedRecipient.leaseId,
        body,
        requestId,
      });
      setComposeOpen(false);
      setFirstMessage("");
      setRecipientSearch("");
      setSelectedRecipientKey(null);
      selectedIdRef.current = result.conversationId;
      setSelectedId(result.conversationId);
      navigate(`/messages?threadId=${encodeURIComponent(result.conversationId)}`);
      await loadConversations(result.conversationId, { background: true });
      await loadThread(result.conversationId);
    } catch (err: any) {
      setComposeError(err?.message || "Failed to send first message");
    } finally {
      setSubmittingFirstMessage(false);
    }
  };
  const selectedConversationTitle = buildConversationTitle(selectedConversation);

  return (
    <div className="rc-messages-page">
      <div className="rc-messages-page-header">
        <h1>Messages</h1>
        {!capsLoading && messagingEnabled ? (
          <button type="button" className="rc-messages-new-button" onClick={() => void openCompose()}>
            New Message
          </button>
        ) : null}
      </div>
      {error && <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div>}
      {!capsLoading && !messagingEnabled ? (
        <LockedFeature
          featureKey="messaging"
          ctaLabel="Upgrade to Starter"
        />
      ) : (
      <>
      {composeOpen ? (
        <div className="rc-messages-compose-overlay" role="dialog" aria-modal="true" aria-label="New message">
          <div className="rc-messages-compose-panel">
            <div className="rc-messages-compose-heading">
              <div>
                <h2>New Message</h2>
                <p>Select a current tenant and send the first message.</p>
              </div>
              <button type="button" onClick={closeCompose} disabled={submittingFirstMessage} aria-label="Close new message">
                Close
              </button>
            </div>
            {composeError ? <div className="rc-messages-compose-error" role="alert">{composeError}</div> : null}
            <label className="rc-messages-compose-field">
              <span>Search tenants</span>
              <input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search by tenant, property, or unit"
              />
            </label>
            <div className="rc-messages-recipient-list" aria-label="Eligible tenants">
              {loadingRecipients ? (
                <div>Loading eligible tenants…</div>
              ) : filteredRecipients.length === 0 ? (
                <div>No eligible current tenants found.</div>
              ) : filteredRecipients.map((recipient) => {
                const key = recipientKey(recipient);
                const selected = key === selectedRecipientKey;
                return (
                  <button
                    type="button"
                    key={key}
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => setSelectedRecipientKey(key)}
                  >
                    <strong>{recipient.tenantDisplayName}</strong>
                    <span>{[recipient.propertyDisplayLabel, recipient.unitDisplayLabel].filter(Boolean).join(" / ")}</span>
                  </button>
                );
              })}
            </div>
            <label className="rc-messages-compose-field">
              <span>Message</span>
              <textarea
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value)}
                maxLength={4000}
                placeholder="Write your message"
              />
            </label>
            <div className="rc-messages-compose-actions">
              <button type="button" onClick={closeCompose} disabled={submittingFirstMessage}>Cancel</button>
              <button
                type="button"
                className="is-primary"
                onClick={() => void handleFirstMessage()}
                disabled={!selectedRecipient || !firstMessage.trim() || submittingFirstMessage}
              >
                {submittingFirstMessage ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="rc-messages-grid" data-testid="messages-layout">
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
            <div
              className="rc-messages-list"
              data-testid="messages-conversation-scroll"
            >
              {loadingList ? (
                <div style={{ color: text.muted }}>Loading…</div>
              ) : conversations.length === 0 ? (
                <div style={{ color: text.muted }}>No conversations yet.</div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <div
                      key={c.id}
                      className="rc-messages-list-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(c.id);
                        navigate(`/messages?threadId=${c.id}`);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
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
                              <TenantNameLabel conversation={c} />
                            </div>
                            <TenantProfileButton conversation={c} />
                            {c.hasUnread ? (
                              <span className="rc-messages-unread-dot" />
                            ) : null}
                          </div>
                          <div className="rc-messages-list-item-meta">
                            {buildConversationMeta(c)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          }
          detail={
            <div className="rc-messages-thread" data-testid="messages-detail-panel">
              {selectedConversation ? (
                <>
                  <div className="rc-messages-thread-header">
                    <div className="rc-messages-thread-title">
                      <ConversationHeaderTitle conversation={selectedConversation} />
                    </div>
                  </div>
                  <div
                    className="rc-messages-thread-body"
                    data-testid="messages-detail-scroll"
                  >
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
                  <div className="rc-messages-composer" data-testid="messages-composer">
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
                <div className="rc-messages-empty-detail">
                  <span>Select a conversation or start a new one.</span>
                  <button type="button" onClick={() => void openCompose()}>New Message</button>
                </div>
              )}
            </div>
          }
        />
      </div>
      </>
      )}
    </div>
  );
}
