import type { TenantAccessWorkspace } from "../../api/tenantAccess";
import type { TenantApplicationCompletionSummary } from "../../api/tenantApplicationCompletion";
import type { TenantAttachment } from "../../api/tenantAttachmentsApi";
import type { TenantProfileData } from "../../api/tenantProfile";
import { buildTenantDocumentVaultView } from "./tenantDocumentVault";
import { buildTenantProfileCompletion } from "./tenantProfileCompletion";
import { prettyStatus } from "./TenantWorkspaceShared";

type ApplicationReuseMetric = {
  label: string;
  value: string;
  accent: string;
  hint: string;
};

type ApplicationReuseItem = {
  label: string;
  status: "ready" | "needs_attention" | "info";
  detail: string;
  actionPath: string | null;
  actionLabel: string | null;
};

type ApplicationShareInsight = {
  label: string;
  detail: string;
};

export type TenantApplicationReuseView = {
  metrics: ApplicationReuseMetric[];
  reusableProfileItems: ApplicationReuseItem[];
  documentItems: ApplicationReuseItem[];
  missingItems: ApplicationReuseItem[];
  shareInsights: ApplicationShareInsight[];
};

function statusLabel(ready: boolean): ApplicationReuseItem["status"] {
  return ready ? "ready" : "needs_attention";
}

function propertySummary(profile: TenantProfileData["profile"]): string {
  const property = profile.property;
  if (!property) return "Property details will appear here when they are linked to this application.";
  return [property.street1, property.street2, property.city, property.province].filter(Boolean).join(", ");
}

export function buildTenantApplicationReuseView(params: {
  completion: TenantApplicationCompletionSummary | null;
  profile: TenantProfileData | null;
  attachments?: { data: TenantAttachment[]; summary?: any; guidance?: any; updatedAt?: number | null } | null;
  access?: TenantAccessWorkspace | null;
}): TenantApplicationReuseView {
  const profileCompletion = params.profile ? buildTenantProfileCompletion(params.profile) : null;
  const documentVault = buildTenantDocumentVaultView({
    items: params.attachments?.data || [],
    summary: params.attachments?.summary,
    guidance: params.attachments?.guidance,
    updatedAt: params.attachments?.updatedAt,
    access: params.access,
  });

  const reusableProfileItems: ApplicationReuseItem[] = params.profile
    ? [
        {
          label: "Profile basics",
          status: statusLabel(Boolean(params.profile.profile.displayName && params.profile.profile.email && params.profile.profile.phone)),
          detail:
            params.profile.profile.displayName && params.profile.profile.email && params.profile.profile.phone
              ? "Your saved profile basics are ready to review for this application."
              : "Add your missing profile basics before continuing.",
          actionPath: "/tenant/profile",
          actionLabel: "Review your profile",
        },
        {
          label: "Rental context",
          status: statusLabel(Boolean(params.profile.profile.property || params.profile.profile.application || params.profile.profile.lease)),
          detail: propertySummary(params.profile.profile),
          actionPath: "/tenant/profile",
          actionLabel: "Open profile",
        },
        {
          label: "Identity status",
          status: statusLabel(params.profile.identity.identityVerification.status === "verified"),
          detail: params.profile.identity.identityVerification.note || "Identity progress is tracked from your tenant-safe profile.",
          actionPath: "/tenant/profile",
          actionLabel: "Review identity",
        },
      ]
    : [
        {
          label: "Profile details",
          status: "needs_attention",
          detail: "Your saved profile summary is not available yet for this application view.",
          actionPath: "/tenant/profile",
          actionLabel: "Open profile",
        },
      ];

  const documentItems: ApplicationReuseItem[] = [
    {
      label: "Ready to share",
      status: documentVault.readyItems.length > 0 ? "ready" : "needs_attention",
      detail:
        documentVault.readyItems.length > 0
          ? `${documentVault.readyItems.length} document${documentVault.readyItems.length === 1 ? "" : "s"} already sit in your profile for supported reuse.`
          : "No documents are marked ready to share yet.",
      actionPath: "/tenant/attachments",
      actionLabel: "Open documents",
    },
    {
      label: "Missing details",
      status: documentVault.missingItems.length === 0 ? "ready" : "needs_attention",
      detail:
        documentVault.missingItems.length === 0
          ? "Your document checklist does not show any missing items right now."
          : `${documentVault.missingItems.length} document item${documentVault.missingItems.length === 1 ? "" : "s"} still need attention before this application feels fully ready.`,
      actionPath: "/tenant/attachments",
      actionLabel: "Add missing details",
    },
  ];

  const missingItems = [
    ...(params.completion?.sections || []).flatMap((section) =>
      section.items
        .filter((item) => ["missing", "needs_review", "not_started", "pending", "in_progress"].includes(item.status))
        .map((item) => ({
          label: item.label,
          status: item.status === "pending" || item.status === "in_progress" ? "info" : "needs_attention",
          detail: item.nextAction || "Review this step before continuing.",
          actionPath: item.actionPath,
          actionLabel: item.actionLabel,
        }))
    ),
    ...(profileCompletion?.sections || []).flatMap((section) =>
      section.items
        .filter((item) => item.status !== "complete")
        .map((item) => ({
          label: item.label,
          status: item.status === "pending" ? "info" : "needs_attention",
          detail: item.detail,
          actionPath: item.actionPath,
          actionLabel: item.actionLabel,
        }))
    ),
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.label === item.label && candidate.detail === item.detail) === index);

  const shareInsights: ApplicationShareInsight[] = [
    {
      label: "Review before sharing",
      detail: "This application view shows what is already in your profile and what still needs work before you continue.",
    },
    {
      label: "Shared with your permission",
      detail:
        params.access?.summary?.activeGrants
          ? `${params.access.summary.activeGrants} supported share record${params.access.summary.activeGrants === 1 ? "" : "s"} are already active in your access workspace.`
          : "No supported profile shares are active right now.",
    },
    {
      label: "Current application status",
      detail: params.profile?.profile?.application?.status
        ? `Your current application is ${prettyStatus(params.profile.profile.application.status)}.`
        : "Your current application status will appear here once this workspace has an active application context.",
    },
  ];

  const metrics: ApplicationReuseMetric[] = [
    {
      label: "Application readiness",
      value: `${params.completion?.progressPercent ?? 0}%`,
      accent: "#1d4ed8",
      hint: "Overall tenant-safe completion progress for this application.",
    },
    {
      label: "Profile reuse",
      value: `${reusableProfileItems.filter((item) => item.status === "ready").length}/${reusableProfileItems.length}`,
      accent: "#0f766e",
      hint: "Saved profile sections already ready for review.",
    },
    {
      label: "Documents ready",
      value: String(documentVault.readyItems.length),
      accent: "#166534",
      hint: "Saved document items already available in your profile.",
    },
    {
      label: "Missing details",
      value: String(missingItems.filter((item) => item.status !== "info").length),
      accent: "#b45309",
      hint: "Items still needing your attention before you continue.",
    },
  ];

  return {
    metrics,
    reusableProfileItems,
    documentItems,
    missingItems,
    shareInsights,
  };
}
