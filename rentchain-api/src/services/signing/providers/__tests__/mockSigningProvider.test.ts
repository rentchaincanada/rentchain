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
    expect(sent.dispatchMode).toBe("mock");
    expect(sent.dispatchStatus).toBe("mocked_no_email");

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

  it("parses raw Buffer JSON supplied by the signing webhook route", async () => {
    const provider = new MockSigningProvider();
    const parsed = await provider.parseWebhookPayload(Buffer.from(JSON.stringify({
      providerRequestId: "mock_request",
      eventId: "event-1",
      type: "signed",
    })));

    expect(parsed).toMatchObject({
      providerRequestId: "mock_request",
      providerEventId: "event-1",
      type: "signed",
    });
  });

  it("parses JSON strings", async () => {
    const provider = new MockSigningProvider();
    const parsed = await provider.parseWebhookPayload(JSON.stringify({
      providerRequestId: "mock_request",
      eventId: "event-1",
      type: "signed",
    }));

    expect(parsed).toMatchObject({
      providerRequestId: "mock_request",
      providerEventId: "event-1",
      type: "signed",
    });
  });

  it("preserves signingRequestId and eventType aliases", async () => {
    const provider = new MockSigningProvider();
    const parsed = await provider.parseWebhookPayload({
      signingRequestId: "mock_alias_request",
      eventId: "event-alias-1",
      eventType: "viewed",
    });

    expect(parsed).toMatchObject({
      providerRequestId: "mock_alias_request",
      providerEventId: "event-alias-1",
      type: "viewed",
    });
  });

  it("preserves the default signed event type", async () => {
    const provider = new MockSigningProvider();
    const parsed = await provider.parseWebhookPayload({
      providerRequestId: "mock_request",
      eventId: "event-default-1",
    });

    expect(parsed.type).toBe("signed");
  });

  it.each([
    ["Buffer", Buffer.from('{"providerRequestId":')],
    ["string", '{"providerRequestId":'],
  ])("rejects malformed %s JSON precisely", async (_kind, body) => {
    const provider = new MockSigningProvider();
    await expect(provider.parseWebhookPayload(body)).rejects.toThrow("signing_webhook_payload_invalid");
  });

  it.each([
    ["Buffer", Buffer.alloc(0)],
    ["string", ""],
  ])("rejects an empty %s body", async (_kind, body) => {
    const provider = new MockSigningProvider();
    await expect(provider.parseWebhookPayload(body)).rejects.toThrow("signing_webhook_payload_invalid");
  });

  it.each([
    ["array", "[]"],
    ["string scalar", '"hello"'],
    ["number", "123"],
    ["null", "null"],
  ])("rejects non-object JSON: %s", async (_kind, body) => {
    const provider = new MockSigningProvider();
    await expect(provider.parseWebhookPayload(body)).rejects.toThrow("signing_webhook_payload_invalid");
  });

  it("fails closed when a webhook has no stable provider event identity", async () => {
    const provider = new MockSigningProvider();

    await expect(
      provider.parseWebhookPayload({
        providerRequestId: "mock_request",
        type: "signed",
      })
    ).rejects.toThrow("signing_webhook_event_identity_missing");
  });
});
