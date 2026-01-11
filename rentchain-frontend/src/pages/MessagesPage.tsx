import React, { useEffect, useMemo, useState } from "react";
import {
  fetchLandlordConversations,
  fetchLandlordConversationMessages,
  sendLandlordMessage,
  markLandlordConversationRead,
  type Conversation,
  type Message,
} from "@/api/messagesApi";
import { spacing, colors, radius, text } from "@/styles/tokens";

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

  const loadConversations = async () => {
    try {
      setLoadingList(true);
      const data = await fetchLandlordConversations();
      setConversations(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
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
    void loadConversations();
    const t = window.setInterval(() => void loadConversations(), POLL_CONVERSATIONS_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const t = window.setInterval(() => void loadThread(selectedId), POLL_THREAD_MS);
    return () => window.clearInterval(t);
  }, [selectedId]);

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
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginBottom: spacing.md }}>Messages</h1>
      {error && <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: spacing.md,
          minHeight: 480,
        }}
      >
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.card,
            overflowY: "auto",
          }}
        >
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
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: `1px solid ${isActive ? colors.accent : colors.border}`,
                    background: isActive ? colors.accentSoft : colors.panel,
                    borderRadius: radius.sm,
                    padding: "10px 12px",
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 600, color: text.primary }}>
                      Tenant {c.tenantId || "unknown"}
                    </div>
                    {c.hasUnread ? (
                      <span style={{ width: 10, height: 10, borderRadius: 10, background: colors.accent }} />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: text.muted }}>
                    Unit {c.unitId || "n/a"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: spacing.sm,
            background: colors.card,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {selectedConversation ? (
            <>
              <div style={{ marginBottom: spacing.sm, fontWeight: 600 }}>
                Conversation with tenant {selectedConversation.tenantId || "unknown"}
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "4px 0",
                }}
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
                    .map((m) => (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: m.senderRole === "landlord" ? "flex-end" : "flex-start",
                          background:
                            m.senderRole === "landlord" ? colors.accentSoft : colors.panel,
                          color: text.primary,
                          padding: "8px 10px",
                          borderRadius: radius.sm,
                          maxWidth: "70%",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div style={{ fontSize: 11, color: text.subtle, marginBottom: 4 }}>
                          {m.senderRole} •{" "}
                          {m.createdAtMs ? new Date(m.createdAtMs).toLocaleString() : ""}
                        </div>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.body}</div>
                      </div>
                    ))
                )}
              </div>
              <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm }}>
                <textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="Write a message"
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    minHeight: 60,
                    padding: 10,
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!composer.trim()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.accent,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: composer.trim() ? "pointer" : "not-allowed",
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
      </div>
    </div>
  );
}
