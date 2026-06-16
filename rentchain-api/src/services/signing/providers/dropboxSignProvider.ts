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

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function boolEnv(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function safeMessage(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function validProviderReadableUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? raw : "";
  } catch {
    return "";
  }
}

function eventTimeToIso(value: unknown) {
  const raw = String(value || "").trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric * (raw.length <= 10 ? 1000 : 1)).toISOString();
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function parseMaybeJsonBuffer(body: unknown) {
  if (!Buffer.isBuffer(body)) return body;
  const raw = body.toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const params = new URLSearchParams(raw);
    const json = params.get("json");
    if (json) return JSON.parse(json);
    const multipartJson = extractMultipartJsonField(raw);
    if (multipartJson) return JSON.parse(multipartJson);
    throw new Error("signing_webhook_payload_invalid");
  }
}

function extractMultipartJsonField(raw: string) {
  const nameMatch = /name="json"|name=json/i.exec(raw);
  if (!nameMatch) return "";
  const headerEnd = raw.indexOf("\r\n\r\n", nameMatch.index);
  if (headerEnd < 0) return "";
  const valueStart = headerEnd + 4;
  const boundaryStart = raw.indexOf("\r\n--", valueStart);
  const value = raw.slice(valueStart, boundaryStart >= 0 ? boundaryStart : undefined).trim();
  return value || "";
}

function safeWebhookBodyShape(input: SigningProviderWebhookInput) {
  const raw = input.rawBody || (Buffer.isBuffer(input.body) ? input.body : undefined);
  const text = raw?.toString("utf8") || "";
  return {
    contentType: String((input.headers as any)?.["content-type"] || "").split(";")[0].slice(0, 80),
    bodyKind: raw ? "buffer" : typeof input.body,
    bodyLength: raw?.length || 0,
    hasUrlEncodedJson: text.includes("json="),
    hasMultipartJson: /name="json"|name=json/i.test(text),
    looksJson: text.trim().startsWith("{"),
  };
}

async function loadDropboxSignSdk() {
  const mod = (await import("@dropbox/sign")) as any;
  return mod.default || mod;
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
    const documentUrl = validProviderReadableUrl(input.documentUrl);
    if (!documentUrl) throw Object.assign(new Error("signing_document_url_required"), { status: 400 });
    try {
      const sdk = await loadDropboxSignSdk();
      const apiCaller = new sdk.SignatureRequestApi();
      apiCaller.username = String(process.env.SIGNING_PROVIDER_API_KEY || "").trim();
      const testMode = boolEnv(process.env.SIGNING_PROVIDER_TEST_MODE);
      const returnUrl = String(input.returnUrl || "").trim() || undefined;
      const request = {
        title: input.title.slice(0, 255),
        subject: input.title.slice(0, 255),
        message: input.message || undefined,
        testMode,
        fileUrls: [documentUrl],
        signers: input.signers.map((signer, index) => ({
          emailAddress: signer.email,
          name: signer.name || signer.email,
          order: index,
        })),
        metadata: {
          leaseId: input.leaseId,
          landlordId: input.landlordId,
        },
        signingOptions: {
          draw: true,
          type: true,
          upload: false,
          phone: false,
          defaultType: "type",
        },
        ...(returnUrl ? { signingRedirectUrl: returnUrl } : {}),
      };
      const response = await apiCaller.signatureRequestSend(request as any);
      const body = response?.body || response || {};
      const signatureRequest = body.signatureRequest || body.signature_request || {};
      const providerRequestId = String(signatureRequest.signatureRequestId || signatureRequest.signature_request_id || "").trim();
      if (!providerRequestId) throw Object.assign(new Error("provider_response_invalid"), { status: 502 });
      return {
        providerRequestId,
        signingUrl: String(signatureRequest.signingUrl || signatureRequest.signing_url || "") || null,
        expiresAt: signatureRequest.expiresAt || signatureRequest.expires_at ? eventTimeToIso(signatureRequest.expiresAt || signatureRequest.expires_at) : null,
        dispatchMode: testMode ? "sandbox" : "real",
        dispatchStatus: "accepted",
        dispatchMessage: testMode
          ? "Dropbox Sign accepted the request in test mode."
          : "Dropbox Sign accepted the request and will dispatch signature email.",
        providerTestMode: testMode,
      };
    } catch (error: any) {
      const status = Number(error?.status || error?.statusCode || error?.code || 502);
      const message = safeMessage(error?.body?.error?.errorMsg || error?.body?.message || error?.message || "provider_dispatch_failed");
      throw Object.assign(new Error("provider_dispatch_failed"), {
        status: status >= 400 && status < 600 ? status : 502,
        safeMessage: message,
      });
    }
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
    const sdk = await loadDropboxSignSdk();
    const apiCaller = new sdk.SignatureRequestApi();
    apiCaller.username = String(process.env.SIGNING_PROVIDER_API_KEY || "").trim();
    const response = await apiCaller.signatureRequestFiles(providerRequestId, "pdf");
    const buffer = Buffer.isBuffer(response?.body) ? response.body : Buffer.from(response?.body || []);
    if (!buffer.length) return null;
    return { buffer, contentType: "application/pdf", fileName: `${providerRequestId}.pdf` };
  }

  async verifyWebhookSignature(input: SigningProviderWebhookInput) {
    const callbackKey = String(process.env.SIGNING_PROVIDER_WEBHOOK_SECRET || process.env.SIGNING_PROVIDER_API_KEY || "").trim();
    if (!callbackKey) return false;
    try {
      const sdk = await loadDropboxSignSdk();
      const parsed = parseMaybeJsonBuffer(input.rawBody || input.body);
      const eventCallback = sdk.EventCallbackRequest?.init ? sdk.EventCallbackRequest.init(parsed) : parsed;
      const valid = sdk.EventCallbackHelper.isValid(callbackKey, eventCallback);
      if (!valid) {
        console.warn("[dropbox-sign-webhook] verification failed", {
          ...safeWebhookBodyShape(input),
          hasEventTime: Boolean(eventCallback?.event?.eventTime),
          hasEventType: Boolean(eventCallback?.event?.eventType),
          hasEventHash: Boolean(eventCallback?.event?.eventHash),
        });
      }
      return valid;
    } catch (error: any) {
      console.warn("[dropbox-sign-webhook] verification parse failed", {
        ...safeWebhookBodyShape(input),
        reason: safeMessage(error?.message || "parse_failed"),
      });
      return false;
    }
  }

  async parseWebhookPayload(body: any): Promise<SigningProviderParsedWebhook> {
    body = parseMaybeJsonBuffer(body);
    const event = body?.event || body?.event_data || body || {};
    const request = body?.signature_request || body?.signatureRequest || {};
    const eventType = String(event?.event_type || event?.type || "").toLowerCase();
    const mapped =
      eventType.includes("fail") || eventType.includes("error") ? "failed" :
      eventType.includes("view") ? "viewed" :
      eventType.includes("decline") || eventType.includes("reject") ? "rejected" :
      eventType.includes("expire") ? "expired" :
      eventType.includes("cancel") ? "cancelled" :
      eventType.includes("complete") || eventType.includes("all_signed") || eventType.includes("sign") ? "signed" :
      "sent";
    const providerRequestId = String(request?.signature_request_id || body?.signature_request_id || body?.providerRequestId || "").trim();
    const providerEventId = String(event?.event_hash || event?.event_id || sha(JSON.stringify(body))).trim();
    if (!providerRequestId) {
      if (eventType === "callback_test" || Boolean(body?.account) || Boolean(body?.template)) {
        return {
          providerRequestId: null,
          providerEventId,
          type: "sent",
          occurredAt: eventTimeToIso(event?.event_time || event?.time || event?.created_at),
          accountCallback: true,
          providerEventType: eventType || null,
        };
      }
      throw new Error("signing_webhook_request_missing");
    }
    return {
      providerRequestId,
      providerEventId,
      type: mapped as any,
      signerEmail: String(body?.signature?.signer_email_address || body?.signerEmail || "").trim().toLowerCase() || null,
      occurredAt: eventTimeToIso(event?.event_time || event?.time || event?.created_at),
      providerEventType: eventType || null,
    };
  }
}
