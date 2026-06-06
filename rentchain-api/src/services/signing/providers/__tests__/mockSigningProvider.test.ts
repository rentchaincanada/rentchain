import { describe, expect, it } from "vitest";
import { MockSigningProvider } from "../mockSigningProvider";

describe("MockSigningProvider", () => {
  it("creates deterministic local signing requests and signing URLs", async () => {
    const provider = new MockSigningProvider();
    const sent = await provider.sendForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      title: "Lease",
      signers: [{ email: "tenant@example.com", role: "tenant" }],
    });

    expect(sent.providerRequestId).toMatch(/^mock_/);
    expect(sent.signingUrl).toContain(sent.providerRequestId);

    const signingUrl = await provider.getSigningUrl({
      providerRequestId: sent.providerRequestId,
      signerEmail: "tenant@example.com",
    });
    expect(signingUrl).toContain(sent.providerRequestId);
  });

  it("parses safe webhook events", async () => {
    const provider = new MockSigningProvider();
    const parsed = await provider.parseWebhookPayload({
      providerRequestId: "mock_request",
      eventId: "evt_1",
      type: "signed",
      signerEmail: "Tenant@Example.com",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });

    expect(parsed).toEqual({
      providerRequestId: "mock_request",
      providerEventId: "evt_1",
      type: "signed",
      signerEmail: "tenant@example.com",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
