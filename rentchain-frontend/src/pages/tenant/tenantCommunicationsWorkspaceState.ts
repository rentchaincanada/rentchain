import type {
  TenantCommunicationsWorkspace,
  TenantThreadMessage,
} from "../../api/tenantCommunicationsApi";

export type TenantCommunicationsInboxState =
  | "empty_inbox"
  | "active_threads"
  | "needs_reply"
  | "informational_only";

export type TenantCommunicationsThreadSummary = {
  id: string;
  landlordLabel: string;
  latestPreview: string;
  latestMessageAt: string | null;
  latestSenderRole: "tenant" | "landlord" | null;
  unreadCount: number;
  needsReply: boolean;
  stateLabel: string;
};

export type TenantCommunicationsWorkspaceView = {
  inboxState: TenantCommunicationsInboxState;
  label: string;
  title: string;
  description: string;
  threadSummaries: TenantCommunicationsThreadSummary[];
  nextSteps: string[];
};

function summarizeBody(body: string | null | undefined): string {
  const text = String(body || "").trim().replace(/\s+/g, " ");
  if (!text) return "No message preview is available yet.";
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function newestMessage(messages: TenantThreadMessage[]): TenantThreadMessage | null {
  return messages.length ? messages[messages.length - 1] || null : null;
}

function inboxLabel(state: TenantCommunicationsInboxState): string {
  if (state === "needs_reply") return "Needs reply";
  if (state === "active_threads") return "Active threads";
  if (state === "informational_only") return "Informational only";
  return "Empty inbox";
}

export function buildTenantCommunicationsWorkspaceState(
  workspace: TenantCommunicationsWorkspace | null | undefined
): TenantCommunicationsWorkspaceView {
  const thread = workspace?.thread || null;
  const messages = thread?.messages || [];
  const latest = newestMessage(messages);
  const needsReply =
    Boolean(thread) &&
    Number(thread?.unreadCount || 0) > 0 &&
    latest?.senderRole === "landlord";

  const threadSummaries: TenantCommunicationsThreadSummary[] = thread
    ? [
        {
          id: thread.id,
          landlordLabel: thread.landlordLabel || "Landlord",
          latestPreview: summarizeBody(latest?.body),
          latestMessageAt: thread.lastMessageAt || latest?.createdAt || null,
          latestSenderRole: latest?.senderRole || null,
          unreadCount: Number(thread.unreadCount || 0),
          needsReply,
          stateLabel: needsReply
            ? "Reply needed"
            : messages.length
            ? "Up to date"
            : "No messages yet",
        },
      ]
    : [];

  if (!thread || messages.length === 0) {
    return {
      inboxState: "empty_inbox",
      label: inboxLabel("empty_inbox"),
      title: "Your inbox is ready when tenancy communication starts",
      description:
        workspace?.canSend === false
          ? workspace.canSendReason || "Messaging is not available for this workspace yet."
          : "Once you or your landlord start a tenancy-scoped conversation, the thread will appear here in one organized place.",
      threadSummaries,
      nextSteps: workspace?.canSend
        ? [
            "Use this workspace when you need to send a tenancy-related update to your landlord.",
            "Watch for new communication here instead of guessing across separate channels.",
          ]
        : [
            "Wait for your tenancy or application communication context to become available.",
            "Use the rest of your tenant workspace while messaging access is still limited.",
          ],
    };
  }

  if (needsReply) {
    return {
      inboxState: "needs_reply",
      label: inboxLabel("needs_reply"),
      title: "A tenancy message is waiting for your reply",
      description:
        "The latest visible thread update came from the property side and still appears unread in your tenant communications workspace.",
      threadSummaries,
      nextSteps: workspace?.canSend
        ? [
            "Open the thread and review the latest landlord message carefully.",
            "Reply in the same tenancy-scoped conversation if a response is needed.",
          ]
        : [
            "Open the thread to review the latest update.",
            workspace?.canSendReason || "Replying is not available from this workspace yet.",
          ],
    };
  }

  if (workspace?.canSend === false) {
    return {
      inboxState: "informational_only",
      label: inboxLabel("informational_only"),
      title: "Your tenancy communication is available as a read-only thread",
      description:
        workspace.canSendReason ||
        "The current thread is visible, but sending is not available from this workspace right now.",
      threadSummaries,
      nextSteps: [
        "Review the latest message and keep this thread as your current communication record.",
        "Use other tenant workspace surfaces until sending becomes available again.",
      ],
    };
  }

  return {
    inboxState: "active_threads",
    label: inboxLabel("active_threads"),
    title: "Your tenancy inbox is active",
    description:
      "This thread keeps your current landlord communication in one bounded, tenancy-scoped workspace.",
    threadSummaries,
    nextSteps: [
      "Use this thread for current tenancy communication so the context stays organized.",
      "Review the latest update before sending a new message.",
    ],
  };
}
