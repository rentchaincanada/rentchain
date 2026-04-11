import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";
import type { TenantAccessWorkspace } from "../api/tenantAccess";
import type { TenantAttachment } from "../api/tenantAttachmentsApi";
import type { TenantProfileData } from "../api/tenantProfile";
import type { TenantApplicationCompletionSummary } from "../api/tenantApplicationCompletion";
import type { SharePackageCategoryKey, SharePackageCategoryView } from "./sharePackageAlignment";
import { buildFollowUpResolutionState } from "./followUpResolutionState";

export type StructuredNotificationTriggerType =
  | "follow_up_requested"
  | "follow_up_addressed"
  | "ready_for_rereview"
  | "readiness_improved"
  | "access_changed"
  | "documents_updated";

export type StructuredNotificationItem = {
  id: string;
  type: StructuredNotificationTriggerType;
  title: string;
  description: string;
  timestamp: number;
  actionRequired: boolean;
  targetLink: string | null;
};

const CATEGORY_TARGETS: Record<SharePackageCategoryKey, string> = {
  profile_details: "/tenant/profile",
  rental_history: "/tenant/profile",
  documents_records: "/tenant/attachments",
  consent_identity_status: "/tenant/access",
  application_readiness: "/tenant/application",
};

function toMillis(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function latestMillis(...values: Array<string | number | null | undefined>): number | null {
  return values.reduce<number | null>((current, value) => {
    const next = toMillis(value);
    if (next == null) return current;
    return current == null ? next : Math.max(current, next);
  }, null);
}

function formatCategorySummary(categories: SharePackageCategoryView[]): string {
  return categories.map((item) => item.label).join(", ");
}

function pushItem(
  items: StructuredNotificationItem[],
  item: Omit<StructuredNotificationItem, "timestamp"> & { timestamp: string | number | null | undefined }
) {
  const timestamp = toMillis(item.timestamp);
  if (timestamp == null) return;
  items.push({
    ...item,
    timestamp,
  });
}

function compareNotifications(left: StructuredNotificationItem, right: StructuredNotificationItem): number {
  if (left.actionRequired !== right.actionRequired) {
    return left.actionRequired ? -1 : 1;
  }
  return right.timestamp - left.timestamp;
}

function firstOpenCategoryLink(categories: SharePackageCategoryView[]): string | null {
  const first = categories[0];
  return first ? CATEGORY_TARGETS[first.key] : null;
}

function primaryAddressedCategoryLabel(categories: SharePackageCategoryView[]): string {
  if (categories.some((item) => item.key === "profile_details")) return "Profile updated";
  if (categories.some((item) => item.key === "documents_records")) return "Documents updated";
  if (categories.some((item) => item.key === "consent_identity_status")) return "Access updated";
  if (categories.some((item) => item.key === "application_readiness")) return "Application updated";
  return "Follow-up items updated";
}

export function buildTenantStructuredNotificationTriggers(params: {
  packageCategories: SharePackageCategoryView[];
  completion: TenantApplicationCompletionSummary | null;
  profile: TenantProfileData | null;
  attachments?: { data: TenantAttachment[]; updatedAt?: number | null } | null;
  access?: TenantAccessWorkspace | null;
}): StructuredNotificationItem[] {
  const items: StructuredNotificationItem[] = [];
  const resolution = buildFollowUpResolutionState(params.packageCategories);
  const followUpTimestamp = latestMillis(
    params.completion?.updatedAt,
    params.profile?.profile.application?.updatedAt,
    params.attachments?.updatedAt,
    params.access?.summary.latestActivityAt
  );

  if (resolution.openFollowUpCategories.length > 0) {
    pushItem(items, {
      id: "tenant-follow-up-requested",
      type: "follow_up_requested",
      title: `Follow-up requested for ${resolution.openFollowUpCategories[0].label}${resolution.openFollowUpCategories.length > 1 ? ` and ${resolution.openFollowUpCategories.length - 1} more` : ""}`,
      description: `${formatCategorySummary(
        resolution.openFollowUpCategories
      )} still need attention before your package is ready for re-review.`,
      timestamp: followUpTimestamp,
      actionRequired: true,
      targetLink: firstOpenCategoryLink(resolution.openFollowUpCategories),
    });
  }

  if (resolution.addressedCategories.length > 0) {
    pushItem(items, {
      id: "tenant-follow-up-addressed",
      type: "follow_up_addressed",
      title:
        resolution.overallState === "ready_for_rereview"
          ? `${primaryAddressedCategoryLabel(resolution.addressedCategories)} — ready for re-review`
          : `${primaryAddressedCategoryLabel(resolution.addressedCategories)} — update saved`,
      description: `${formatCategorySummary(
        resolution.addressedCategories
      )} now appear addressed from the latest tenant-safe workspace data.`,
      timestamp: followUpTimestamp,
      actionRequired: false,
      targetLink: "/tenant/application",
    });
  }

  if (resolution.overallState === "ready_for_rereview") {
    pushItem(items, {
      id: "tenant-ready-for-rereview",
      type: "ready_for_rereview",
      title: "Application ready for re-review",
      description: "The requested follow-up categories now appear addressed and are ready to review again.",
      timestamp: followUpTimestamp,
      actionRequired: false,
      targetLink: "/tenant/application",
    });
  }

  if ((params.completion?.progressPercent || 0) > 0) {
    pushItem(items, {
      id: "tenant-readiness-improved",
      type: "readiness_improved",
      title:
        (params.completion?.progressPercent || 0) >= 80
          ? "Application now ready for review"
          : "Application readiness improved",
      description: `Your application readiness is ${params.completion?.progressPercent || 0}% complete in the current tenant-safe checklist.`,
      timestamp: params.completion?.updatedAt,
      actionRequired: false,
      targetLink: "/tenant/application",
    });
  }

  if (params.attachments?.updatedAt && params.attachments.data.length > 0) {
    pushItem(items, {
      id: "tenant-documents-updated",
      type: "documents_updated",
      title: "Documents updated",
      description: `${params.attachments.data.length} document${params.attachments.data.length === 1 ? "" : "s"} are currently in your tenant document workspace.`,
      timestamp: params.attachments.updatedAt,
      actionRequired: false,
      targetLink: "/tenant/attachments",
    });
  }

  if (params.access?.summary.latestActivityAt) {
    pushItem(items, {
      id: "tenant-access-changed",
      type: "access_changed",
      title: "Access changed",
      description:
        params.access.summary.activeGrants > 0
          ? `${params.access.summary.activeGrants} active access grant${params.access.summary.activeGrants === 1 ? "" : "s"} are available in your access workspace.`
          : "Your access workspace shows recent sharing activity.",
      timestamp: params.access.summary.latestActivityAt,
      actionRequired: false,
      targetLink: "/tenant/access",
    });
  }

  return items.sort(compareNotifications).slice(0, 6);
}

export function buildLandlordStructuredNotificationTriggers(
  summary: ApplicationReviewSummary,
  packageCategories: SharePackageCategoryView[]
): StructuredNotificationItem[] {
  const items: StructuredNotificationItem[] = [];
  const resolution = buildFollowUpResolutionState(packageCategories);
  const reviewTimestamp = latestMillis(
    summary.decisionSummary?.riskSnapshot?.updatedAt,
    summary.generatedAt
  );

  if (resolution.openFollowUpCategories.length > 0) {
    pushItem(items, {
      id: `landlord-follow-up-requested-${summary.applicationId}`,
      type: "follow_up_requested",
      title: `Follow-up requested for ${resolution.openFollowUpCategories[0].label}${resolution.openFollowUpCategories.length > 1 ? ` and ${resolution.openFollowUpCategories.length - 1} more` : ""}`,
      description: `${formatCategorySummary(
        resolution.openFollowUpCategories
      )} still need follow-up in the current authorized review package.`,
      timestamp: reviewTimestamp,
      actionRequired: true,
      targetLink: null,
    });
  }

  if (resolution.addressedCategories.length > 0) {
    pushItem(items, {
      id: `landlord-follow-up-addressed-${summary.applicationId}`,
      type: "follow_up_addressed",
      title: "Tenant updated follow-up items",
      description: `${formatCategorySummary(
        resolution.addressedCategories
      )} now appear addressed from the latest authorized review summary.`,
      timestamp: summary.generatedAt,
      actionRequired: false,
      targetLink: null,
    });
  }

  if (resolution.overallState === "ready_for_rereview") {
    pushItem(items, {
      id: `landlord-ready-for-rereview-${summary.applicationId}`,
      type: "ready_for_rereview",
      title: "Application ready for re-review",
      description: "The visible follow-up categories now appear addressed and are ready to review again.",
      timestamp: reviewTimestamp,
      actionRequired: false,
      targetLink: null,
    });
  }

  return items.sort(compareNotifications).slice(0, 4);
}
