import {
  TENANT_IDENTITY_ACCEPTED_MIME_TYPES,
  TENANT_IDENTITY_MAX_FILE_BYTES,
  type TenantIdentityDocument,
  type TenantIdentityDocumentSide,
  type TenantIdentityDocumentType,
} from "../../api/tenantIdentityDocumentsApi";

export const TENANT_IDENTITY_DOCUMENT_TYPES: Array<{ value: TenantIdentityDocumentType; label: string }> = [
  { value: "drivers_license", label: "Driver’s licence" },
  { value: "passport", label: "Passport" },
  { value: "provincial_id", label: "Provincial identification" },
  { value: "other_government_photo_id", label: "Other approved government-issued photo ID" },
];

export function sidesForDocumentType(type: TenantIdentityDocumentType): Array<{ value: TenantIdentityDocumentSide; label: string }> {
  if (type === "passport") return [{ value: "photo_page", label: "Photo page" }];
  if (type === "drivers_license" || type === "provincial_id") {
    return [
      { value: "front", label: "Front" },
      { value: "back", label: "Back" },
    ];
  }
  return [{ value: "single", label: "Single image" }];
}

export function validateIdentityImage(file: File): string | null {
  if (!TENANT_IDENTITY_ACCEPTED_MIME_TYPES.includes(file.type as any)) {
    return "Unsupported image format. Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size > TENANT_IDENTITY_MAX_FILE_BYTES) return "File too large. Choose an image smaller than 10 MB.";
  return null;
}

export function activeTenantIdentityDocuments(documents: TenantIdentityDocument[]) {
  return documents.filter((document) => !["replaced", "deletion_scheduled"].includes(document.status));
}

export function tenantIdentityStatusLabel(documents: TenantIdentityDocument[]) {
  const active = activeTenantIdentityDocuments(documents);
  if (active.some((document) => document.status === "ready")) return "Government ID received";
  if (active.some((document) => document.status === "processing" || document.status === "pending_upload")) return "Upload in progress";
  if (active.some((document) => document.status === "rejected")) return "Action required";
  return "Government ID required";
}

export function tenantIdentityErrorMessage(error: any) {
  const code = String(error?.payload?.error || error?.message || "").trim();
  if (code.includes("FILE_TOO_LARGE")) return "File too large. Choose an image smaller than 10 MB.";
  if (code.includes("UNSUPPORTED") || code.includes("MIME") || code.includes("INPUT_INVALID")) return "Unsupported image format or document details.";
  if (code.includes("IMAGE_DIMENSIONS") || code.includes("PIXEL")) return "Image dimensions are unsupported. Choose a smaller image.";
  if (code.includes("CONSENT_REQUIRED")) return "Government ID collection consent is required before upload.";
  if (code.includes("UNAUTHORIZED") || code.includes("NOT_FOUND")) return "This document is not available in your tenant workspace.";
  return "Upload failed — try again.";
}
