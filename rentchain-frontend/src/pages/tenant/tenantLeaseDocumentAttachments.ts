import type { TenantAttachment } from "../../api/tenantAttachmentsApi";
import { projectTenantAttachmentMetadata } from "../../api/tenantAttachmentProjection";
import type { TenantLeaseDocumentContext, TenantWorkspaceLease } from "../../api/tenantPortal";

function referenceFor(kind: string, value: string): string {
  return `${kind}-ref-${value.trim() || "current"}`;
}

function normalizeDocumentSignal(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTenantLeaseOrScheduleDocumentAttachment(item: TenantAttachment): boolean {
  const signals = [
    item.category,
    item.purpose,
    item.purposeLabel,
    item.title,
    item.fileName,
    item.label,
  ]
    .map(normalizeDocumentSignal)
    .filter(Boolean);
  return signals.some(
    (value) =>
      /(^| )(lease|leases)( |$)/.test(value) ||
      /(^| )tenancy agreement( |$)/.test(value) ||
      /(^| )schedule a( |$)/.test(value)
  );
}

function documentContextToAttachment(
  lease: TenantWorkspaceLease,
  context: TenantLeaseDocumentContext | null | undefined,
  kind: "lease" | "schedule-a"
): TenantAttachment | null {
  if (!context) return null;
  if (kind === "schedule-a" && context.documentStatus !== "generated") return null;
  if (kind === "lease") {
    const signingLifecycleState = String(lease.signingLifecycleState || context.signingLifecycleState || "")
      .trim()
      .toLowerCase();
    const leaseDocumentAvailable =
      signingLifecycleState !== "signed"
        ? context.documentStatus === "generated"
        : context.documentStatus === "signed" &&
          String(lease.signedDocumentState || context.signedDocumentState || "").trim().toLowerCase() === "available" &&
          (lease.signedDocumentAvailable ?? context.signedDocumentAvailable) === true &&
          (lease.viewSignedDocumentAllowed ?? context.viewSignedDocumentAllowed) === true;
    if (!leaseDocumentAvailable) return null;
  }
  if (kind === "lease") {
    const documentReference = referenceFor("document", "lease-document-context-current");
    return {
      id: documentReference,
      documentReference,
      tenantReference: context.tenantId ? referenceFor("tenant", "current") : null,
      leaseReference: context.leaseId ? referenceFor("lease", "current") : null,
      title: "Lease document",
      label: "Lease document",
      category: "Lease documents",
      status: context.documentStatus === "pending" ? "pending_review" : "uploaded",
      purpose: "LEASE",
      purposeLabel: "Lease",
      fileName: "lease-document.pdf",
      uploadedAt: null,
      createdAt: null,
      nextAction: "This tenant-safe lease document is linked to your lease workspace.",
    };
  }
  const documentReference = referenceFor("document", "schedule-a-context-current");
  return {
    id: documentReference,
    documentReference,
    tenantReference: context.tenantId ? referenceFor("tenant", "current") : null,
    leaseReference: context.leaseId ? referenceFor("lease", "current") : null,
    title: "Schedule A",
    label: "Schedule A",
    category: "Attachments",
    status: context.documentStatus === "pending" ? "pending_review" : "uploaded",
    purpose: "SCHEDULE_A",
    purposeLabel: "Schedule A",
    fileName: "schedule-a.pdf",
    uploadedAt: null,
    createdAt: null,
    nextAction: "This tenant-safe lease attachment is linked to your lease workspace.",
  };
}

export function tenantLeaseWorkspaceAttachments(lease: TenantWorkspaceLease | null | undefined): TenantAttachment[] {
  if (!lease) return [];
  return [
    documentContextToAttachment(lease, lease.leaseDocumentContext, "lease"),
    documentContextToAttachment(lease, lease.scheduleADocumentContext, "schedule-a"),
  ].filter(Boolean) as TenantAttachment[];
}

function metadataOnlyAttachment(item: TenantAttachment): TenantAttachment {
  return projectTenantAttachmentMetadata(item) as TenantAttachment;
}

export function mergeTenantAttachments(items: TenantAttachment[], leaseWorkspaceItems: TenantAttachment[]): TenantAttachment[] {
  const merged: TenantAttachment[] = [];
  const seen = new Set<string>();
  for (const item of [...leaseWorkspaceItems, ...items]) {
    const purpose = String(item.purpose || item.purposeLabel || item.label || "").trim().toUpperCase();
    const isLeasePackageDocument = isTenantLeaseOrScheduleDocumentAttachment(item);
    const key = [
      purpose,
      isLeasePackageDocument ? "lease-workspace" : String(item.leaseReference || "").trim(),
      String(item.fileName || item.title || item.label || "").trim().toLowerCase(),
      isLeasePackageDocument ? "" : String(item.id || "").trim(),
    ].join("|");
    const fallbackKey = String(item.id || key).trim();
    const finalKey = key.replace(/\|/g, "") ? key : fallbackKey;
    if (seen.has(finalKey)) continue;
    seen.add(finalKey);
    merged.push(metadataOnlyAttachment(item));
  }
  return merged;
}
