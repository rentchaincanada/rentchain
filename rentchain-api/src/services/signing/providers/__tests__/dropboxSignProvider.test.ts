import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropboxSignProvider } from "../dropboxSignProvider";

const signatureRequestSendMock = vi.fn();
const signatureRequestFilesMock = vi.fn();

vi.mock("@dropbox/sign", () => ({
  default: {
    SignatureRequestApi: class {
      username = "";
      signatureRequestSend = signatureRequestSendMock;
      signatureRequestFiles = signatureRequestFilesMock;
    },
  },
  SignatureRequestApi: class {
    username = "";
    signatureRequestSend = signatureRequestSendMock;
    signatureRequestFiles = signatureRequestFilesMock;
  },
}));

describe("DropboxSignProvider", () => {
  beforeEach(() => {
    signatureRequestSendMock.mockReset();
    signatureRequestFilesMock.mockReset();
    process.env.SIGNING_PROVIDER_API_KEY = "dropbox-key";
    process.env.SIGNING_PROVIDER_WEBHOOK_SECRET = "webhook-secret";
    process.env.SIGNING_PROVIDER_TEST_MODE = "true";
    delete process.env.SIGNING_PROVIDER_CALLBACK_URL;
  });

  it("sends a Dropbox Sign request in test mode and maps safe dispatch metadata", async () => {
    signatureRequestSendMock.mockResolvedValueOnce({
      body: {
        signature_request: {
          signature_request_id: "raw_provider_request_123",
          signing_url: "https://app.hellosign.com/sign/raw_provider_request_123",
        },
      },
    });

    const provider = new DropboxSignProvider();
    const result = await provider.sendForSignature({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      documentUrl: "https://files.example.com/lease.pdf",
      title: "Lease signature request",
      signers: [{ email: "tenant@example.com", role: "tenant" }],
      message: "Please sign.",
    });

    expect(signatureRequestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrls: ["https://files.example.com/lease.pdf"],
        testMode: true,
        metadata: { leaseId: "lease-1", landlordId: "landlord-1" },
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        providerRequestId: "raw_provider_request_123",
        dispatchMode: "sandbox",
        dispatchStatus: "accepted",
        providerTestMode: true,
      })
    );
  });

  it("fails closed when config or provider-readable document URL is missing", async () => {
    const provider = new DropboxSignProvider();
    process.env.SIGNING_PROVIDER_API_KEY = "";
    expect(provider.isConfigured()).toBe(false);

    process.env.SIGNING_PROVIDER_API_KEY = "dropbox-key";
    await expect(
      provider.sendForSignature({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        documentUrl: "gs://private/lease.pdf",
        title: "Lease",
        signers: [{ email: "tenant@example.com" }],
      })
    ).rejects.toThrow("signing_document_url_required");
    expect(signatureRequestSendMock).not.toHaveBeenCalled();
  });

  it("maps provider API failures to a safe dispatch error", async () => {
    signatureRequestSendMock.mockRejectedValueOnce({ status: 400, body: { error: { errorMsg: "Bad file URL" } } });
    const provider = new DropboxSignProvider();

    await expect(
      provider.sendForSignature({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        documentUrl: "https://files.example.com/lease.pdf",
        title: "Lease",
        signers: [{ email: "tenant@example.com" }],
      })
    ).rejects.toMatchObject({ message: "provider_dispatch_failed", status: 400, safeMessage: "Bad file URL" });
  });

  it("verifies webhook signatures and parses Dropbox Sign lifecycle events", async () => {
    const provider = new DropboxSignProvider();
    const body = JSON.stringify({
      event: { event_type: "signature_request_all_signed", event_hash: "evt_1", event_time: 1780000000 },
      signature_request: { signature_request_id: "raw_provider_request_123" },
      signature: { signer_email_address: "Tenant@Example.com" },
    });
    const signature = createHmac("sha256", "webhook-secret").update(body).digest("hex");

    await expect(provider.verifyWebhookSignature({ headers: { "x-dropbox-signature": signature }, body: Buffer.from(body) })).resolves.toBe(true);
    await expect(provider.verifyWebhookSignature({ headers: { "x-dropbox-signature": "bad" }, body: Buffer.from(body) })).resolves.toBe(false);
    await expect(provider.parseWebhookPayload(Buffer.from(body))).resolves.toEqual({
      providerRequestId: "raw_provider_request_123",
      providerEventId: "evt_1",
      type: "signed",
      signerEmail: "tenant@example.com",
      occurredAt: "2026-05-28T20:26:40.000Z",
    });
  });
});
