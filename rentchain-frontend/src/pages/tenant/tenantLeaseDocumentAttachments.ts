import type { TenantAttachment } from "../../api/tenantAttachmentsApi";
import type { TenantLeaseDocumentContext, TenantWorkspaceLease } from "../../api/tenantPortal";

function documentContextToAttachment(
  context: TenantLeaseDocumentContext | null | undefined,
  kind: "lease" | "schedule-a"
): TenantAttachment | null {
  if (!context || !context.documentUrl || context.documentStatus === "missing") return null;
  const leaseId = String(context.leaseId || "current").trim() || "current";
  if (kind === "lease") {
    return {
      id: `lease-document-context-${leaseId}`,
      tenantId: context.tenantId || null,
      leaseId: context.leaseId || null,
      title: "Lease document",
      label: "Lease document",
      category: "Lease documents",
      status: context.documentStatus === "pending" ? "pending_review" : "uploaded",
      purpose: "LEASE",
      purposeLabel: "Lease",
      fileName: "lease-document.pdf",
      url: context.documentUrl,
      uploadedAt: null,
      createdAt: null,
      nextAction: "This tenant-safe lease document is linked to your lease workspace.",
    };
  }
  return {
    id: `schedule-a-context-${leaseId}`,
    tenantId: context.tenantId || null,
    leaseId: context.leaseId || null,
    title: "Schedule A",
    label: "Schedule A",
    category: "Lease documents / attachments",
    status: context.documentStatus === "pending" ? "pending_review" : "uploaded",
    purpose: "SCHEDULE_A",
    purposeLabel: "Schedule A",
    fileName: "schedule-a.pdf",
    url: context.documentUrl,
    uploadedAt: null,
    createdAt: null,
    nextAction: "This tenant-safe lease attachment is linked to your lease workspace.",
  };
}

export function tenantLeaseWorkspaceAttachments(lease: TenantWorkspaceLease | null | undefined): TenantAttachment[] {
  if (!lease) return [];
  return [
    documentContextToAttachment(lease.leaseDocumentContext, "lease"),
    documentContextToAttachment(lease.scheduleADocumentContext, "schedule-a"),
  ].filter(Boolean) as TenantAttachment[];
}

export function mergeTenantAttachments(items: TenantAttachment[], leaseWorkspaceItems: TenantAttachment[]): TenantAttachment[] {
  const merged: TenantAttachment[] = [];
  const seen = new Set<string>();
  for (const item of [...leaseWorkspaceItems, ...items]) {
    const key = [
      String(item.purpose || "").trim().toUpperCase(),
      String(item.leaseId || "").trim(),
      String(item.fileName || item.title || item.label || "").trim().toLowerCase(),
      String(item.url || "").trim(),
    ].join("|");
    const fallbackKey = String(item.id || key).trim();
    const finalKey = key.replace(/\|/g, "") ? key : fallbackKey;
    if (seen.has(finalKey)) continue;
    seen.add(finalKey);
    merged.push(item);
  }
  return merged;
}
