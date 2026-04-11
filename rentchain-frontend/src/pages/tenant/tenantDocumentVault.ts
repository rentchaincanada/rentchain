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

function needsAttention(item: TenantAttachment): boolean {
  return item.status === "missing" || item.status === "needs_attention" || item.status === "reupload_requested";
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
  const items = Array.isArray(params.items) ? [...params.items] : [];
  const summary = params.summary;
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
      value: summary?.total ?? items.length,
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
