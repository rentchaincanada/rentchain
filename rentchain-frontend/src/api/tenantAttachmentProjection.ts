import type { TenantAttachment } from "./tenantAttachmentsApi";

const tenantAttachmentStatuses = new Set<TenantAttachment["status"]>([
  "missing",
  "uploaded",
  "pending_review",
  "verified",
  "needs_attention",
  "reupload_requested",
]);

export function optionalTenantAttachmentString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export function optionalTenantAttachmentNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function tenantAttachmentInternalPath(value: unknown): string | null | undefined {
  const path = optionalTenantAttachmentString(value);
  if (path == null) return path;
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export function projectTenantAttachmentMetadata(value: unknown): TenantAttachment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = optionalTenantAttachmentString(raw.id)?.trim();
  if (!id) return null;
  const status = tenantAttachmentStatuses.has(raw.status as TenantAttachment["status"])
    ? (raw.status as TenantAttachment["status"])
    : undefined;

  return {
    id,
    documentReference: optionalTenantAttachmentString(raw.documentReference),
    tenantReference: optionalTenantAttachmentString(raw.tenantReference),
    leaseReference: optionalTenantAttachmentString(raw.leaseReference),
    draftReference: optionalTenantAttachmentString(raw.draftReference),
    ledgerReference: optionalTenantAttachmentString(raw.ledgerReference),
    title: optionalTenantAttachmentString(raw.title),
    purpose: optionalTenantAttachmentString(raw.purpose),
    purposeLabel: optionalTenantAttachmentString(raw.purposeLabel),
    fileName: optionalTenantAttachmentString(raw.fileName),
    sha256: optionalTenantAttachmentString(raw.sha256),
    createdAt: optionalTenantAttachmentNumber(raw.createdAt),
    label: optionalTenantAttachmentString(raw.label),
    category: optionalTenantAttachmentString(raw.category),
    status,
    uploadedAt: optionalTenantAttachmentNumber(raw.uploadedAt),
    nextAction: optionalTenantAttachmentString(raw.nextAction),
    actionAvailable: typeof raw.actionAvailable === "boolean" ? raw.actionAvailable : undefined,
    actionLabel: optionalTenantAttachmentString(raw.actionLabel),
    actionPath: tenantAttachmentInternalPath(raw.actionPath),
    helpLabel: optionalTenantAttachmentString(raw.helpLabel),
    helpPath: tenantAttachmentInternalPath(raw.helpPath),
  };
}
