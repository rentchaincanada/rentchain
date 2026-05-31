import type { TenantAccessWorkspace } from "../../api/tenantAccess";
import type { TenantAttachment, TenantAttachmentGuidance, TenantAttachmentSummary } from "../../api/tenantAttachmentsApi";

type VaultMetric = {
  label: string;
  value: number;
  accent: string;
  hint: string;
};

type VaultDocumentGroup = {
  category: string;
  items: TenantAttachment[];
  actionPath?: string;
  actionLabel?: string;
};

type VaultShareInsight = {
  id: string;
  label: string;
  detail: string;
  status: "shared" | "unshared" | "limited";
};

export type TenantDocumentVaultView = {
  metrics: VaultMetric[];
  readyItems: TenantAttachment[];
  missingItems: TenantAttachment[];
  recentItems: TenantAttachment[];
  groupedItems: VaultDocumentGroup[];
  shareInsights: VaultShareInsight[];
  updatedAt: number | null;
  guidance: TenantAttachmentGuidance | undefined;
};

function isReadyToShare(item: TenantAttachment): boolean {
  return item.status === "uploaded" || item.status === "verified";
}

const DOCUMENT_LABELS: Record<string, string> = {
  AGREEMENT: "Agreement",
  APPLICATION: "Application",
  BANK_STATEMENT: "Bank statement",
  GOVERNMENT_ID: "Government ID",
  IDENTITY: "Identity document",
  INCOME: "Income document",
  INSURANCE: "Insurance document",
  LEASE: "Lease document",
  PAYSTUB: "Paystub",
  PHOTO_ID: "Photo ID",
  PROOF_OF_INCOME: "Proof of income",
  RENTAL_APPLICATION: "Rental application",
  SCHEDULE_A: "Schedule A",
};

function normalizeDocumentToken(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function titleCaseDocumentToken(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function readableDocumentLabel(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = normalizeDocumentToken(raw);
  if (!normalized) return null;
  if (DOCUMENT_LABELS[normalized]) return DOCUMENT_LABELS[normalized];
  if (/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(normalized) && raw === raw.toUpperCase()) return titleCaseDocumentToken(normalized);
  return raw;
}

function tenantDocumentDisplayLabel(item: TenantAttachment): string {
  const rawLabel = String(item.label || "").trim();
  if (rawLabel && !rawLabel.includes("—") && rawLabel !== rawLabel.toUpperCase()) {
    return readableDocumentLabel(rawLabel) || rawLabel;
  }

  const purposeLabel = readableDocumentLabel(item.purposeLabel);
  if (purposeLabel) return purposeLabel;

  const purpose = readableDocumentLabel(item.purpose);
  const title = readableDocumentLabel(item.title);
  if (rawLabel.includes("—")) {
    const [, suffix] = rawLabel.split("—").map((part) => part.trim());
    const suffixLabel = readableDocumentLabel(suffix);
    if (suffixLabel) return suffixLabel;
  }
  const label = readableDocumentLabel(rawLabel);
  if (label) return label;
  if (title) return title;
  if (purpose) return purpose;
  return "Document";
}

function tenantDocumentCategory(item: TenantAttachment): string {
  const category = String(item.category || "").trim();
  const normalizedCategory = category.toLowerCase();
  const purpose = normalizeDocumentToken(item.purpose);
  const label = tenantDocumentDisplayLabel(item).toLowerCase();

  if (normalizedCategory === "lease documents / attachments") return "Attachments";
  if (purpose === "SCHEDULE_A" || label === "schedule a") return "Attachments";
  if (purpose === "LEASE" || normalizedCategory === "lease") return "Lease documents";
  return category || "Documents";
}

function normalizeTenantDocumentItem(item: TenantAttachment): TenantAttachment {
  return {
    ...item,
    label: tenantDocumentDisplayLabel(item),
    category: tenantDocumentCategory(item),
  };
}

function needsAttention(item: TenantAttachment): boolean {
  return item.status === "missing" || item.status === "needs_attention" || item.status === "reupload_requested";
}

function isVisibleLeaseAttachment(item: TenantAttachment): boolean {
  const category = String(item.category || "").trim().toLowerCase();
  const purpose = String(item.purpose || "").trim().toUpperCase();
  const purposeLabel = String(item.purposeLabel || "").trim().toLowerCase();
  const title = String(item.title || "").trim().toLowerCase();
  const label = String(item.label || "").trim().toLowerCase();
  return (
    category === "lease" ||
    category === "lease documents" ||
    purpose === "LEASE" ||
    purpose === "SCHEDULE_A" ||
    purposeLabel === "lease" ||
    purposeLabel === "schedule a" ||
    title === "lease document" ||
    title === "schedule a" ||
    label.includes("lease") ||
    label === "schedule a"
  );
}

function visibleLeaseKeys(item: TenantAttachment): string[] {
  if (!isVisibleLeaseAttachment(item)) return [];
  const tenantRef = String(item.tenantReference || "").trim() || "tenant";
  const leaseRef = String(item.leaseReference || "").trim();
  const purpose = normalizeDocumentToken(item.purpose) || normalizeDocumentToken(item.label);
  const fileName = String(item.fileName || item.title || item.label || "").trim().toLowerCase();
  return [
    purpose ? `${tenantRef}|document-purpose:${purpose}` : null,
    purpose && fileName ? `${tenantRef}|document-purpose:${purpose}|file:${fileName}` : null,
    `${tenantRef}|lease:current|${purpose || "LEASE"}`,
    leaseRef ? `${tenantRef}|lease:${leaseRef}|${purpose || "LEASE"}` : null,
  ].filter((value): value is string => Boolean(value));
}

function dedupeVisibleLeaseItems(items: TenantAttachment[]): TenantAttachment[] {
  const sortedItems = [...items].sort((a, b) => Number(b.uploadedAt || b.createdAt || 0) - Number(a.uploadedAt || a.createdAt || 0));
  const output: TenantAttachment[] = [];
  const leaseKeySets: Set<string>[] = [];

  sortedItems.forEach((item) => {
    const keys = visibleLeaseKeys(item);
    if (!keys.length) {
      output.push(item);
      return;
    }

    const existingIndex = leaseKeySets.findIndex((knownKeys) => keys.some((key) => knownKeys.has(key)));
    if (existingIndex >= 0) {
      keys.forEach((key) => leaseKeySets[existingIndex].add(key));
      return;
    }

    output.push(item);
    leaseKeySets.push(new Set(keys));
  });

  return output;
}

function statusRank(status?: TenantAttachment["status"]): number {
  switch (status) {
    case "reupload_requested":
      return 0;
    case "needs_attention":
      return 1;
    case "missing":
      return 2;
    case "pending_review":
      return 3;
    case "uploaded":
      return 4;
    case "verified":
      return 5;
    default:
      return 6;
  }
}

function categoryRank(category: string): number {
  switch (category) {
    case "Identity":
      return 0;
    case "Income":
      return 1;
    case "Lease":
      return 2;
    case "Invite":
      return 3;
    default:
      return 4;
  }
}

function buildShareInsights(access?: TenantAccessWorkspace | null): VaultShareInsight[] {
  const activeAccess = access?.activeAccess || [];
  if (activeAccess.length) {
    return activeAccess.map((grant) => ({
      id: grant.id,
      label: grant.categories.join(", ") || "Shared access",
      detail: `${grant.grantedToLabel}. ${grant.accessLabel}.`,
      status: "shared" as const,
    }));
  }

  return [
    {
      id: "documents-not-separately-shared",
      label: "Documents in your vault",
      detail: "Saved to your profile and not separately shared from this vault in v1.",
      status: "unshared",
    },
    {
      id: "sharing-controls",
      label: "Selective sharing",
      detail: "Document-specific sharing controls are not available yet, so this vault stays read-first.",
      status: "limited",
    },
  ];
}

export function buildTenantDocumentVaultView(params: {
  items: TenantAttachment[];
  summary?: TenantAttachmentSummary;
  guidance?: TenantAttachmentGuidance;
  updatedAt?: number | null;
  access?: TenantAccessWorkspace | null;
}): TenantDocumentVaultView {
  const items = dedupeVisibleLeaseItems(Array.isArray(params.items) ? params.items.map(normalizeTenantDocumentItem) : []);
  const readyItems = items.filter(isReadyToShare);
  const missingItems = items.filter(needsAttention);
  const recentItems = [...items]
    .sort((a, b) => Number(b.uploadedAt || b.createdAt || 0) - Number(a.uploadedAt || a.createdAt || 0))
    .slice(0, 3);

  const groupedItems = Array.from(
    items.reduce((map, item) => {
      const category = item.category || "Documents";
      const current = map.get(category) || [];
      current.push(item);
      map.set(category, current);
      return map;
    }, new Map<string, TenantAttachment[]>())
  )
    .map(([category, grouped]) => ({
      category,
      actionPath: category === "Lease documents" ? "/tenant/lease" : undefined,
      actionLabel: category === "Lease documents" ? "Open lease details" : undefined,
      items: [...grouped].sort((a, b) => {
        const priority = statusRank(a.status) - statusRank(b.status);
        if (priority !== 0) return priority;
        return Number(b.uploadedAt || b.createdAt || 0) - Number(a.uploadedAt || a.createdAt || 0);
      }),
    }))
    .sort((a, b) => {
      const priority = categoryRank(a.category) - categoryRank(b.category);
      if (priority !== 0) return priority;
      return a.category.localeCompare(b.category);
    });

  const metrics: VaultMetric[] = [
    {
      label: "In your vault",
      value: items.length,
      accent: "#0f766e",
      hint: "Documents already connected to your tenant profile.",
    },
    {
      label: "Ready to share",
      value: readyItems.length,
      accent: "#166534",
      hint: "Saved files that are already available in your profile.",
    },
    {
      label: "Missing or needs attention",
      value: missingItems.length,
      accent: "#9a3412",
      hint: "Items still missing or needing follow-up before they are fully ready.",
    },
    {
      label: "Shared with permission",
      value: params.access?.summary?.activeGrants ?? 0,
      accent: "#1d4ed8",
      hint: "Current supported profile shares you have already granted.",
    },
  ];

  return {
    metrics,
    readyItems,
    missingItems,
    recentItems,
    groupedItems,
    shareInsights: buildShareInsights(params.access),
    updatedAt: typeof params.updatedAt === "number" ? params.updatedAt : null,
    guidance: params.guidance,
  };
}
