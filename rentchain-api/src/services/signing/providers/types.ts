export type SigningProviderId = "mock" | "dropbox_sign" | "boldsign" | "hellosign";

export type SigningProviderEventType =
  | "sent"
  | "viewed"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "downloaded";

export type SigningProviderSigner = {
  email: string;
  name?: string | null;
  role?: "tenant" | "landlord";
};

export type SigningProviderSendInput = {
  leaseId: string;
  landlordId: string;
  documentUrl?: string | null;
  title: string;
  message?: string | null;
  signers: SigningProviderSigner[];
  callbackUrl?: string | null;
};

export type SigningProviderSendResult = {
  providerRequestId: string;
  signingUrl?: string | null;
  expiresAt?: string | null;
};

export type SigningProviderSigningUrlInput = {
  providerRequestId: string;
  signerEmail?: string | null;
  redirectUrl?: string | null;
};

export type SigningProviderDocumentResult = {
  buffer: Buffer;
  contentType: "application/pdf";
  fileName: string;
};

export type SigningProviderWebhookInput = {
  headers: Record<string, unknown>;
  body: unknown;
  rawBody?: Buffer;
};

export type SigningProviderParsedWebhook = {
  providerRequestId: string;
  providerEventId: string;
  type: SigningProviderEventType;
  signerEmail?: string | null;
  occurredAt: string;
};

export interface ISigningProvider {
  getProviderId(): SigningProviderId;
  getName(): string;
  isConfigured(): boolean;
  sendForSignature(input: SigningProviderSendInput): Promise<SigningProviderSendResult>;
  getSigningUrl(input: SigningProviderSigningUrlInput): Promise<string | null>;
  cancelRequest(providerRequestId: string): Promise<boolean>;
  downloadSignedDocument(providerRequestId: string): Promise<SigningProviderDocumentResult | null>;
  verifyWebhookSignature(input: SigningProviderWebhookInput): Promise<boolean>;
  parseWebhookPayload(body: unknown): Promise<SigningProviderParsedWebhook>;
}
