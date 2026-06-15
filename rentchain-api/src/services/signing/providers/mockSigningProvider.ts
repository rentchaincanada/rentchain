import { createHash } from "crypto";
import type {
  ISigningProvider,
  SigningProviderDocumentResult,
  SigningProviderParsedWebhook,
  SigningProviderSendInput,
  SigningProviderSendResult,
  SigningProviderSigningUrlInput,
  SigningProviderWebhookInput,
} from "./types";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function nowIso() {
  return new Date().toISOString();
}

export class MockSigningProvider implements ISigningProvider {
  getProviderId() {
    return "mock" as const;
  }

  getName() {
    return "Mock signing provider";
  }

  isConfigured() {
    return true;
  }

  async sendForSignature(input: SigningProviderSendInput): Promise<SigningProviderSendResult> {
    const providerRequestId = `mock_${digest(`${input.landlordId}:${input.leaseId}:${input.signers.map((s) => s.email).join(",")}`)}`;
    return {
      providerRequestId,
      signingUrl: `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/tenant/lease?mockSigningRequest=${providerRequestId}`,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      dispatchMode: "mock",
      dispatchStatus: "mocked_no_email",
      dispatchMessage: "Mock signing provider recorded the request without sending email.",
    };
  }

  async getSigningUrl(input: SigningProviderSigningUrlInput) {
    const redirect = input.redirectUrl ? `&redirect=${encodeURIComponent(input.redirectUrl)}` : "";
    return `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/tenant/lease?mockSigningRequest=${encodeURIComponent(input.providerRequestId)}${redirect}`;
  }

  async cancelRequest() {
    return true;
  }

  async downloadSignedDocument(providerRequestId: string): Promise<SigningProviderDocumentResult> {
    return {
      buffer: Buffer.from(`Signed lease document\nrequest=${providerRequestId}\n`, "utf8"),
      contentType: "application/pdf",
      fileName: `${providerRequestId}.pdf`,
    };
  }

  async verifyWebhookSignature(input: SigningProviderWebhookInput) {
    const expected = String(process.env.SIGNING_PROVIDER_WEBHOOK_SECRET || "").trim();
    if (!expected) return true;
    return String((input.headers as any)?.["x-mock-signing-secret"] || "").trim() === expected;
  }

  async parseWebhookPayload(body: any): Promise<SigningProviderParsedWebhook> {
    const providerRequestId = String(body?.providerRequestId || body?.signingRequestId || "").trim();
    if (!providerRequestId) throw new Error("signing_webhook_request_missing");
    const type = String(body?.type || body?.eventType || "signed").trim().toLowerCase();
    const allowed = new Set(["sent", "viewed", "signed", "rejected", "expired", "cancelled", "failed", "downloaded"]);
    if (!allowed.has(type)) throw new Error("signing_webhook_type_invalid");
    return {
      providerRequestId,
      providerEventId: String(body?.eventId || `mock_evt_${digest(`${providerRequestId}:${type}:${nowIso()}`)}`).trim(),
      type: type as any,
      signerEmail: String(body?.signerEmail || "").trim().toLowerCase() || null,
      occurredAt: String(body?.occurredAt || nowIso()),
    };
  }
}
