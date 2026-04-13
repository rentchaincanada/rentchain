import React, { useEffect, useMemo, useState } from "react";
import {
  getTenantCommunicationsWorkspace,
  markTenantCommunicationsRead,
  sendTenantCommunicationMessage,
} from "../../api/tenantCommunicationsApi";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";
import { buildTenantCommunicationsWorkspaceState } from "./tenantCommunicationsWorkspaceState";

export default function TenantMessagesCenterPage() {
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof getTenantCommunicationsWorkspace>> | null>(null);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTenantCommunicationsWorkspace();
      setWorkspace(res);
      await markTenantCommunicationsRead().catch(() => undefined);
    } catch (err: any) {
      setError(err?.message || "Unable to load messages.");
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const thread = workspace?.thread;
  const messages = useMemo(() => thread?.messages || [], [thread]);
  const inboxView = useMemo(
    () => buildTenantCommunicationsWorkspaceState(workspace),
    [workspace]
  );

  const handleSend = async () => {
    const body = composer.trim();
    if (!body || !workspace?.canSend) return;
    setSending(true);
    setError(null);
    try {
      await sendTenantCommunicationMessage(body);
      setComposer("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Unable to send your message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Communications"
        subtitle="Message your landlord through the tenant-safe communications channel linked to your tenancy or application."
      >
        <TenantLoadingState label="Loading your communications workspace..." />
      </TenantSurfaceShell>
    );
  }

  if (error && !workspace) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell
        title="Communications"
        subtitle="This view stays scoped to your tenant authority context and never falls back to landlord surfaces."
      >
        {unauthorized ? <TenantUnauthorizedState /> : <TenantErrorState message={error} retry={load} />}
      </TenantSurfaceShell>
    );
  }

  return (
    <TenantSurfaceShell
      title="Communications"
      subtitle="Use this tenancy-scoped inbox to review recent communication, understand what needs attention, and keep the current conversation organized."
    >
      <TenantInfoCard heading="Inbox summary" accent="#1d4ed8">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: textTokens.primary }}>
              {inboxView.title}
            </div>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
              {inboxView.description}
            </div>
          </div>
          <div style={{ color: textTokens.secondary }}>
            Inbox state: <strong>{inboxView.label}</strong>
          </div>
          <div style={{ color: textTokens.secondary }}>
            Contact: <strong>{thread?.landlordLabel || "Landlord"}</strong>
          </div>
          <div style={{ color: textTokens.secondary }}>
            Unread messages: <strong>{thread?.unreadCount || 0}</strong>
          </div>
          <div style={{ color: textTokens.secondary }}>
            Last activity:{" "}
            <strong>{thread?.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : "No messages yet"}</strong>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Recent messages" accent="#0f766e">
        {inboxView.threadSummaries.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {inboxView.threadSummaries.map((summary) => (
              <div
                key={summary.id}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>
                    Conversation with {summary.landlordLabel}
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      color: summary.needsReply ? "#9a3412" : "#1d4ed8",
                      background: summary.needsReply ? "#ffedd5" : "#dbeafe",
                    }}
                  >
                    {summary.stateLabel}
                  </div>
                </div>
                <div style={{ color: textTokens.secondary }}>
                  Latest update: {summary.latestPreview}
                </div>
                <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                  {summary.latestMessageAt
                    ? `Updated ${new Date(summary.latestMessageAt).toLocaleString()}`
                    : "No messages yet"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TenantEmptyState
            title="No thread activity yet"
            body="A tenancy-scoped conversation will appear here once communication starts."
          />
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="What to do next" accent="#7c3aed">
        <div style={{ display: "grid", gap: 8 }}>
          {inboxView.nextSteps.map((step) => (
            <div key={step} style={{ color: textTokens.secondary }}>
              {step}
            </div>
          ))}
        </div>
      </TenantInfoCard>

      {!workspace?.canSend ? (
        <TenantInfoCard heading="Messaging availability" accent="#b45309">
          <div style={{ color: textTokens.secondary }}>
            {workspace?.canSendReason || "Messaging is not available for this workspace yet."}
          </div>
        </TenantInfoCard>
      ) : null}

      {error ? (
        <TenantErrorState message={error} retry={load} />
      ) : (
        <div style={{ display: "grid", gap: spacing.md }}>
          <TenantInfoCard heading="Conversation thread" accent="#0891b2">
            {messages.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: message.senderRole === "tenant" ? "end" : "start",
                      justifySelf: message.senderRole === "tenant" ? "end" : "start",
                      maxWidth: "78%",
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      background: message.senderRole === "tenant" ? "#eff6ff" : "#f8fafc",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, color: textTokens.muted }}>
                      {message.senderRole === "tenant" ? "You" : thread?.landlordLabel || "Landlord"} •{" "}
                      {message.createdAt ? new Date(message.createdAt).toLocaleString() : "—"}
                    </div>
                    <div style={{ color: textTokens.primary, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {message.body}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <TenantEmptyState
                title="No messages yet"
                body="Once you or your landlord start a conversation, the thread will appear here."
              />
            )}
          </TenantInfoCard>

          <TenantInfoCard heading="Send a message" accent="#7c3aed">
            <div style={{ display: "grid", gap: spacing.sm }}>
              <textarea
                aria-label="Compose message"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                disabled={!workspace?.canSend || sending}
                placeholder={
                  workspace?.canSend
                    ? "Write a message for your landlord"
                    : "Messaging is disabled until your authority context is active."
                }
                style={{
                  minHeight: 110,
                  resize: "vertical",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  padding: "12px 14px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: textTokens.muted, fontSize: "0.9rem" }}>
                  Messages are limited to your current tenancy or application context.
                </div>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!composer.trim() || !workspace?.canSend || sending}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: !composer.trim() || !workspace?.canSend || sending ? "#e2e8f0" : "#0f766e",
                    color: !composer.trim() || !workspace?.canSend || sending ? "#64748b" : "#fff",
                    fontWeight: 700,
                    cursor: !composer.trim() || !workspace?.canSend || sending ? "not-allowed" : "pointer",
                  }}
                >
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          </TenantInfoCard>
        </div>
      )}
    </TenantSurfaceShell>
  );
}
