import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLandlordConversationMessage, fetchLandlordMessageRecipients } from "./messagesApi";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  apiFetch: apiFetchMock,
}));

describe("landlord message compose API", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("loads the bounded server-projected recipient list", async () => {
    apiFetchMock.mockResolvedValue({ recipients: [{ leaseId: "lease-1", tenantId: "tenant-1" }] });

    await expect(fetchLandlordMessageRecipients()).resolves.toEqual([
      { leaseId: "lease-1", tenantId: "tenant-1" },
    ]);
    expect(apiFetchMock).toHaveBeenCalledWith("/landlord/messages/recipients");
  });

  it("sends only the selected lease, tenant, body, and idempotency request id", async () => {
    apiFetchMock.mockResolvedValue({ conversationId: "conversation-1", created: true, message: {} });
    const input = {
      leaseId: "lease-1",
      tenantId: "tenant-1",
      body: "First message",
      requestId: "request-first-message-1",
    };

    await createLandlordConversationMessage(input);

    expect(apiFetchMock).toHaveBeenCalledWith("/landlord/messages/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });
});
