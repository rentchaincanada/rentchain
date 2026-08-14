import type { IdentityVerificationStatus } from "./identityDocumentTypes";
import type { IdentityVerificationResult } from "./identityDocumentSchemas";

export type IdentityVerificationProviderCapabilities = {
  supportedDocumentTypes: readonly string[];
  acceptsOriginal: boolean;
  acceptsSanitizedDerivative: boolean;
  supportsProviderDeletion: boolean;
};

export type IdentityVerificationReference = {
  providerKey: string;
  providerReference: string;
  verificationId: string;
};

export type IdentityVerificationRequest = {
  verificationId: string;
  subjectId: string;
  documentVersionIds: string[];
  consentEventId: string;
  correlationId: string;
};

export type OneTimeIdentityDocumentGrant = {
  verification: IdentityVerificationReference;
  documentVersionId: string;
  representation: "original" | "sanitized_derivative";
  grantReference: string;
  expiresAt: string;
};

export type IdentityProviderDeletionReceipt = {
  providerReference: string;
  status: "deleted" | "not_found" | "pending";
  recordedAt: string;
};

/** Future G2 server boundary only. G1A has no implementation, network calls, or webhook registration. */
export interface IdentityVerificationProvider {
  capabilities(): IdentityVerificationProviderCapabilities;
  createVerification(input: IdentityVerificationRequest): Promise<IdentityVerificationReference>;
  attachDocument(input: OneTimeIdentityDocumentGrant): Promise<void>;
  getVerificationStatus(reference: IdentityVerificationReference): Promise<IdentityVerificationResult>;
  refreshVerification(reference: IdentityVerificationReference): Promise<IdentityVerificationResult>;
  cancelVerification(reference: IdentityVerificationReference): Promise<{ status: IdentityVerificationStatus }>;
  handleWebhook(input: { rawBody: Uint8Array; headers: Readonly<Record<string, string>> }): Promise<{
    eventId: string;
    reference: IdentityVerificationReference;
  }>;
  deleteProviderData(reference: IdentityVerificationReference): Promise<IdentityProviderDeletionReceipt>;
}
