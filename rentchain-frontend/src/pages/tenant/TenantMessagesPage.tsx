import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ensureTenantConversation,
  fetchTenantConversationMessages,
  sendTenantMessage,
  markTenantConversationRead,
  type Conversation,
  type Message,
} from "@/api/messagesApi";
import { spacing, colors, radius, text } from "@/styles/tokens";
import { getTenantToken } from "../../lib/tenantAuth";

const POLL_THREAD_MS = 12000;

export default function TenantMessagesPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const location = useLocation();
  const tenantToken = typeof window === "undefined" ? null : getTenantToken();

  const loadConversation = async () => {
    try {
      const res = await ensureTenantConversation();
      setConversation(res.conversation);
      return res.conversation?.id || null;
    } catch (err: any) {
      if (err?.payload?.error === "UNAUTHORIZED" || err?.status === 401 || String(err?.message || "").includes("401")) {
        setSessionExpired(true);
        setConversation(null);
        setMessages([]);
        setError(null);
        return null;
      }
      setError(err?.message || "Failed to load conversation");
      return null;
    }
  };

  const loadThread = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetchTenantConversationMessages(id);
      setMessages(res.messages || []);
      await markTenantConversationRead(id);
    } catch (err: any) {
      if (err?.payload?.error === "UNAUTHORIZED" || err?.status === 401 || String(err?.message || "").includes("401")) {
        setSessionExpired(true);
        setConversation(null);
        setMessages([]);
        setError(null);
        return;
      }
      setError(err?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const deepLinkId = new URLSearchParams(location.search).get("c");
      const id = await loadConversation();
      if (id && mounted) {
        const targetId = deepLinkId && deepLinkId === id ? deepLinkId : id;
        await loadThread(targetId);
        const t = window.setInterval(() => void loadThread(targetId), POLL_THREAD_MS);
        return () => window.clearInterval(t);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [location.search]);

  if (!tenantToken || sessionExpired) {
    const next = encodeURIComponent(`/tenant/messages${location.search || ""}`);
    return (
      <div style={{ padding: spacing.lg }}>
        <div style={{ color: text.muted, marginBottom: spacing.sm }}>
          Your session expired. Please sign in again.
        </div>
        <a
          href={`/tenant/login?next=${next}`}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.accent,
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Go to tenant login
        </a>
      </div>
    );
  }

  const handleSend = async () => {
    if (!conversation?.id || !composer.trim()) return;
    const body = composer.trim();
    setComposer("");
    await sendTenantMessage(conversation.id, body);
    await loadThread(conversation.id);
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginBottom: spacing.md }}>Messages</h1>
      {sessionExpired ? (
        <div style={{ marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, background: "#fff7ed", color: "#9a3412", border: `1px solid ${colors.border}` }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Your session expired. Please sign in again.</div>
          <a
            href={`/tenant/login?next=${encodeURIComponent(`/tenant/messages${location.search || ""}`)}`}
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              color: "#9a3412",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign in
          </a>
        </div>
      ) : null}
      {error && <div style={{ color: colors.danger, marginBottom: spacing.sm }}>{error}</div>}
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: spacing.sm,
          background: colors.card,
          display: "flex",
          flexDirection: "column",
          minHeight: 420,
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ color: text.muted }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: text.muted }}>No messages yet.</div>
        ) : (
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
            {messages
              .slice()
              .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))
              .map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.senderRole === "tenant" ? "flex-end" : "flex-start",
                    background: m.senderRole === "tenant" ? colors.accentSoft : colors.panel,
                    color: text.primary,
                    padding: "8px 10px",
                    borderRadius: radius.sm,
                    maxWidth: "70%",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: text.subtle, marginBottom: 4 }}>
                    {m.senderRole} • {m.createdAtMs ? new Date(m.createdAtMs).toLocaleString() : ""}
                  </div>
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              ))}
          </div>
        )}

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
            disabled={!composer.trim() || !conversation}
            style={{
              padding: "10px 14px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.accent,
              color: "#fff",
              fontWeight: 700,
              cursor: composer.trim() && conversation ? "pointer" : "not-allowed",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
