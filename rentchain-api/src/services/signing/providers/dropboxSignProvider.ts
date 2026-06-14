import { createHash, createHmac, timingSafeEqual } from "crypto";
import type {
  ISigningProvider,
  SigningProviderDocumentResult,
  SigningProviderParsedWebhook,
  SigningProviderSendInput,
  SigningProviderSendResult,
  SigningProviderSigningUrlInput,
  SigningProviderWebhookInput,
} from "./types";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class DropboxSignProvider implements ISigningProvider {
  getProviderId() {
    return "dropbox_sign" as const;
  }

  getName() {
    return "Dropbox Sign";
  }

  isConfigured() {
    return Boolean(String(process.env.SIGNING_PROVIDER_API_KEY || "").trim());
  }

  async sendForSignature(input: SigningProviderSendInput): Promise<SigningProviderSendResult> {
    if (!this.isConfigured()) throw new Error("provider_unavailable");
    return {
      providerRequestId: `dropbox_${sha(`${input.landlordId}:${input.leaseId}:${Date.now()}`)}`,
      signingUrl: null,
      expiresAt: null,
      dispatchMode: "stub",
      dispatchStatus: "stubbed_no_email",
      dispatchMessage: "Dropbox Sign provider is configured as a local stub and did not send email.",
    };
  }

  async getSigningUrl(input: SigningProviderSigningUrlInput) {
    if (!this.isConfigured()) throw new Error("provider_unavailable");
    return input.redirectUrl || null;
  }

  async cancelRequest() {
    if (!this.isConfigured()) throw new Error("provider_unavailable");
    return true;
  }

  async downloadSignedDocument(providerRequestId: string): Promise<SigningProviderDocumentResult | null> {
    if (!this.isConfigured()) throw new Error("provider_unavailable");
    return {
      buffer: Buffer.from(`Dropbox Sign document placeholder\nrequest=${providerRequestId}\n`, "utf8"),
      contentType: "application/pdf",
      fileName: `${providerRequestId}.pdf`,
    };
  }

  async verifyWebhookSignature(input: SigningProviderWebhookInput) {
    const secret = String(process.env.SIGNING_PROVIDER_WEBHOOK_SECRET || "").trim();
    if (!secret) return false;
    const raw = input.rawBody?.toString("utf8") || JSON.stringify(input.body || {});
    const supplied = String((input.headers as any)?.["x-dropbox-signature"] || (input.headers as any)?.["x-hellosign-signature"] || "").trim();
    if (!supplied) return false;
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    return safeCompare(supplied, expected);
  }

  async parseWebhookPayload(body: any): Promise<SigningProviderParsedWebhook> {
    const event = body?.event || body?.event_data || body || {};
    const request = body?.signature_request || body?.signatureRequest || {};
    const eventType = String(event?.event_type || event?.type || "").toLowerCase();
    const mapped =
      eventType.includes("view") ? "viewed" :
      eventType.includes("decline") || eventType.includes("reject") ? "rejected" :
      eventType.includes("expire") ? "expired" :
      eventType.includes("cancel") ? "cancelled" :
      eventType.includes("sign") ? "signed" :
      "sent";
    const providerRequestId = String(request?.signature_request_id || body?.signature_request_id || body?.providerRequestId || "").trim();
    if (!providerRequestId) throw new Error("signing_webhook_request_missing");
    return {
      providerRequestId,
      providerEventId: String(event?.event_hash || event?.event_id || sha(JSON.stringify(body))).trim(),
      type: mapped as any,
      signerEmail: String(body?.signature?.signer_email_address || body?.signerEmail || "").trim().toLowerCase() || null,
      occurredAt: new Date(Number(event?.event_time || Date.now()) * (String(event?.event_time || "").length <= 10 ? 1000 : 1)).toISOString(),
    };
  }
}
