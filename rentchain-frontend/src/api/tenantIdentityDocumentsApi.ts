import { tenantApiFetch } from "./tenantApiFetch";

export const TENANT_IDENTITY_ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const TENANT_IDENTITY_MAX_FILE_BYTES = 10 * 1024 * 1024;

export type TenantIdentityDocumentType =
  | "drivers_license"
  | "passport"
  | "provincial_id"
  | "other_government_photo_id";

export type TenantIdentityDocumentSide = "front" | "back" | "photo_page" | "single";

export type TenantIdentityDocument = {
  documentId: string;
  documentType: TenantIdentityDocumentType;
  side: TenantIdentityDocumentSide;
  status: "pending_upload" | "processing" | "ready" | "rejected" | "replaced" | "deletion_scheduled";
  verificationStatus: "not_started" | "pending" | "verified" | "review_required" | "failed" | "expired" | "cancelled";
  mimeType: (typeof TENANT_IDENTITY_ACCEPTED_MIME_TYPES)[number];
  byteSize: number;
  width: number;
  height: number;
  uploadedAt: string;
  sanitizedAccessAvailable: boolean;
};

export type TenantIdentityRequirementStatus = {
  required: true;
  requirementStatus: "action_required" | "satisfied";
  collectionStatus: "not_uploaded" | "received";
  verificationStatus: TenantIdentityDocument["verificationStatus"];
  activeDocumentCount: number;
  consent: {
    purpose: "identity_document_collection";
    requirementPolicyId: string;
    requirementPolicyVersion: string;
    policyTextVersion: string;
    privacyNoticeVersion: string;
    retentionPolicyVersion: string;
  };
  acceptedMimeTypes: readonly string[];
  maxFileBytes: number;
  applicationContinuity: boolean;
  tenantContinuity: boolean;
  biometricProcessing: false;
  pdfSupported: false;
};

export type TenantIdentityAccess = {
  accessReference: string;
  expiresAt: string;
  expiresInSeconds: 300;
  representation: "sanitized";
  cachePolicy: "private, no-store";
};

export async function getTenantIdentityRequirement(): Promise<TenantIdentityRequirementStatus> {
  const response = await tenantApiFetch<{ ok: true; data: TenantIdentityRequirementStatus }>(
    "/tenant/identity-documents/status",
  );
  return response.data;
}

export async function listTenantIdentityDocuments(): Promise<TenantIdentityDocument[]> {
  const response = await tenantApiFetch<{ ok: true; data: TenantIdentityDocument[] }>("/tenant/identity-documents");
  return Array.isArray(response.data) ? response.data : [];
}

export async function recordTenantIdentityConsent(displayedLocale: string): Promise<void> {
  await tenantApiFetch("/tenant/identity-documents/consent", {
    method: "POST",
    body: { acknowledged: true, displayedLocale },
  });
}

export async function uploadTenantIdentityDocument(input: {
  file: File;
  documentType: TenantIdentityDocumentType;
  side: TenantIdentityDocumentSide;
  issuingCountry: string;
  issuingRegion?: string;
  replaceDocumentId?: string;
}): Promise<TenantIdentityDocument> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("documentType", input.documentType);
  form.append("side", input.side);
  form.append("issuingCountry", input.issuingCountry);
  if (input.issuingRegion) form.append("issuingRegion", input.issuingRegion);
  if (input.replaceDocumentId) form.append("replaceDocumentId", input.replaceDocumentId);
  const response = await tenantApiFetch<{ ok: true; data: TenantIdentityDocument }>("/tenant/identity-documents", {
    method: "POST",
    body: form,
  });
  return response.data;
}

export async function getTenantIdentityDocumentAccess(documentId: string): Promise<TenantIdentityAccess> {
  const response = await tenantApiFetch<{ ok: true; data: TenantIdentityAccess }>(
    `/tenant/identity-documents/${encodeURIComponent(documentId)}/access`,
    { method: "POST", body: {} },
  );
  return response.data;
}

export async function deleteTenantIdentityDocument(documentId: string): Promise<void> {
  await tenantApiFetch(`/tenant/identity-documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
}
