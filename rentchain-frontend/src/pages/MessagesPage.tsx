import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  fetchLandlordConversations,
  fetchLandlordConversationMessages,
  sendLandlordMessage,
  markLandlordConversationRead,
  type Conversation,
  type Message,
} from "@/api/messagesApi";
import { spacing, colors, text } from "@/styles/tokens";
import { useIsMobile } from "@/hooks/useIsMobile";
import "./MessagesPage.css";

const POLL_CONVERSATIONS_MS = 15000;
const POLL_THREAD_MS = 12000;

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const loadConversations = async (preferredId?: string | null) => {
    try {
      setLoadingList(true);
      const data = await fetchLandlordConversations();
      setConversations(data);
      if (preferredId) {
        setSelectedId(preferredId);
        if (isMobile) setMobileView("chat");
      } else if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  };

  const loadThread = async (id: string) => {
    try {
      setLoadingThread(true);
      const res = await fetchLandlordConversationMessages(id);
      setMessages(res.messages || []);
      await markLandlordConversationRead(id);
    } catch (err: any) {
      setError(err?.message || "Failed to load messages");
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deepLinkId = params.get("c");
    void (async () => {
      await loadConversations(deepLinkId);
      if (deepLinkId) {
        await loadThread(deepLinkId);
      }
    })();
    const t = window.setInterval(() => void loadConversations(selectedId), POLL_CONVERSATIONS_MS);
    return () => window.clearInterval(t);
  }, [location.search, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const t = window.setInterval(() => void loadThread(selectedId), POLL_THREAD_MS);
    return () => window.clearInterval(t);
  }, [selectedId]);

  useEffect(() => {
    if (!isMobile) return;
    if (selectedId) {
      setMobileView("chat");
    }
  }, [isMobile, selectedId]);

  const handleSend = async () => {
    if (!selectedId || !composer.trim()) return;
    const body = composer.trim();
    setComposer("");
    await sendLandlordMessage(selectedId, body);
    await loadThread(selectedId);
    await loadConversations();
  };

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  return (
    <div className="rc-messages-page">
      <h1 style={{ marginBottom: spacing.md }}>Messages</h1>
      {error && <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div>}
      <div className="rc-messages-grid">
        {(!isMobile || mobileView === "list") && (
          <div className="rc-messages-list">
            <div className="rc-messages-list-header">Conversations</div>
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
                      if (isMobile) setMobileView("chat");
                      window.history.replaceState({}, "", `/messages?c=${c.id}`);
                    }}
                    style={{
                      border: `1px solid ${isActive ? colors.accent : colors.border}`,
                      background: isActive ? colors.accentSoft : colors.panel,
                    }}
                  >
                    <div className="rc-messages-list-item-row">
                      <div className="rc-messages-list-item-title">
                        Tenant {c.tenantId || "unknown"}
                      </div>
                      {c.hasUnread ? (
                        <span className="rc-messages-unread-dot" />
                      ) : null}
                    </div>
                    <div className="rc-messages-list-item-meta">
                      Unit {c.unitId || "n/a"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {(!isMobile || mobileView === "chat") && (
          <div className="rc-messages-thread">
            {selectedConversation ? (
              <>
                <div className="rc-messages-thread-header">
                  {isMobile ? (
                    <button
                      type="button"
                      className="rc-messages-back"
                      onClick={() => setMobileView("list")}
                    >
                      Back
                    </button>
                  ) : null}
                  <div className="rc-messages-thread-title">
                    Conversation with tenant {selectedConversation.tenantId || "unknown"}
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
        )}
      </div>
    </div>
  );
}
