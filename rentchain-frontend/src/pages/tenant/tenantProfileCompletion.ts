import type { TenantProfileData, TenantProfileStatus } from "../../api/tenantProfile";
import { prettyStatus } from "./TenantWorkspaceShared";

export type TenantProfileCompletionItemStatus =
  | "complete"
  | "pending"
  | "missing"
  | "needs_attention";

export type TenantProfileCompletionSection = {
  key: string;
  label: string;
  status: TenantProfileCompletionItemStatus;
  items: Array<{
    key: string;
    label: string;
    status: TenantProfileCompletionItemStatus;
    detail: string;
    actionPath: string | null;
    actionLabel: string | null;
  }>;
};

export type TenantProfileCompletionSummary = {
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  overallStatus: TenantProfileCompletionItemStatus;
  missingItems: string[];
  sections: TenantProfileCompletionSection[];
};

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function toCompletionStatus(
  status: TenantProfileStatus | TenantProfileCompletionItemStatus
): TenantProfileCompletionItemStatus {
  switch (status) {
    case "verified":
      return "complete";
    case "pending":
      return "pending";
    case "needs_review":
    case "needs_attention":
      return "needs_attention";
    case "complete":
      return "complete";
    default:
      return "missing";
  }
}

function scoreStatus(status: TenantProfileCompletionItemStatus): number {
  switch (status) {
    case "complete":
      return 1;
    case "pending":
      return 0.5;
    case "needs_attention":
      return 0.25;
    default:
      return 0;
  }
}

function combineStatuses(
  items: Array<{ status: TenantProfileCompletionItemStatus }>
): TenantProfileCompletionItemStatus {
  if (!items.length) return "missing";
  if (items.some((item) => item.status === "needs_attention")) return "needs_attention";
  if (items.some((item) => item.status === "missing")) return "missing";
  if (items.some((item) => item.status === "pending")) return "pending";
  return "complete";
}

function documentChecklistStatus(
  data: TenantProfileData
): TenantProfileCompletionItemStatus {
  const items = Array.isArray(data.identity?.documentChecklist)
    ? data.identity.documentChecklist
    : [];
  if (!items.length) {
    return Array.isArray(data.identity?.nextSteps) && data.identity.nextSteps.length > 0
      ? "missing"
      : "complete";
  }
  if (items.some((item) => item.status === "needs_review")) return "needs_attention";
  if (items.some((item) => item.status === "missing")) return "missing";
  if (items.some((item) => item.status === "pending")) return "pending";
  return "complete";
}

export function buildTenantProfileCompletion(
  data: TenantProfileData
): TenantProfileCompletionSummary {
  const property = data.profile?.property;
  const lease = data.profile?.lease;
  const application = data.profile?.application;
  const documentEntry = data.actions?.documentEntry;

  const sections: TenantProfileCompletionSection[] = [
    {
      key: "contact",
      label: "Contact details",
      items: [
        {
          key: "display_name",
          label: "Display name",
          status: hasValue(data.profile?.displayName) ? "complete" : "missing",
          detail: hasValue(data.profile?.displayName)
            ? "Your profile name is ready to share when needed."
            : "Add the name you want attached to your rental profile.",
          actionPath: "/tenant/profile",
          actionLabel: "Update profile",
        },
        {
          key: "email",
          label: "Email address",
          status: hasValue(data.profile?.email) ? "complete" : "pending",
          detail: hasValue(data.profile?.email)
            ? "Your email is already connected to this tenant profile."
            : "Your email will appear here once it is linked to this profile view.",
          actionPath: null,
          actionLabel: null,
        },
        {
          key: "phone",
          label: "Phone number",
          status: hasValue(data.profile?.phone) ? "complete" : "missing",
          detail: hasValue(data.profile?.phone)
            ? "Your contact number is on file."
            : "Add a phone number so your profile stays current.",
          actionPath: "/tenant/profile",
          actionLabel: "Update profile",
        },
      ],
      status: "missing",
    },
    {
      key: "rental_record",
      label: "Rental record",
      items: [
        {
          key: "property_summary",
          label: "Property summary",
          status: property ? "complete" : "pending",
          detail: property
            ? "Your current property is connected to this profile."
            : "Your current property summary will appear here when it is linked.",
          actionPath: null,
          actionLabel: null,
        },
        {
          key: "application_or_lease",
          label: "Application or lease",
          status: application || lease ? "complete" : "pending",
          detail: lease
            ? `Your lease is ${prettyStatus(lease.status)}.`
            : application
            ? `Your application is ${prettyStatus(application.status)}.`
            : "A linked application or lease will round out your rental profile.",
          actionPath: application ? "/tenant/application" : lease ? "/tenant/lease" : "/tenant/dashboard",
          actionLabel: application ? "View application" : lease ? "View lease" : "View dashboard",
        },
      ],
      status: "pending",
    },
    {
      key: "identity_documents",
      label: "Identity and documents",
      items: [
        {
          key: "identity_verification",
          label: "Identity verification",
          status: toCompletionStatus(data.identity?.identityVerification?.status || "missing"),
          detail:
            data.identity?.identityVerification?.note ||
            "Your identity progress will appear here as it moves forward.",
          actionPath: "/tenant/profile",
          actionLabel: "Review profile",
        },
        {
          key: "document_checklist",
          label: "Documents",
          status: documentChecklistStatus(data),
          detail:
            documentEntry?.note ||
            (documentChecklistStatus(data) === "complete"
              ? "Your current tenant-safe document checklist is in good shape."
              : "Review your document checklist to see what still needs attention."),
          actionPath: documentEntry?.path || "/tenant/attachments",
          actionLabel: documentEntry?.label || "Review documents",
        },
      ],
      status: "pending",
    },
  ];

  sections.forEach((section) => {
    section.status = combineStatuses(section.items);
  });

  const allItems = sections.flatMap((section) => section.items);
  const completedCount = allItems.filter((item) => item.status === "complete").length;
  const progressPercent = Math.round(
    (allItems.reduce((sum, item) => sum + scoreStatus(item.status), 0) / Math.max(allItems.length, 1)) * 100
  );
  const missingItems = allItems
    .filter((item) => item.status !== "complete")
    .map((item) => `${item.label}: ${item.detail}`);

  return {
    progressPercent,
    completedCount,
    totalCount: allItems.length,
    overallStatus: combineStatuses(sections),
    missingItems,
    sections,
  };
}
