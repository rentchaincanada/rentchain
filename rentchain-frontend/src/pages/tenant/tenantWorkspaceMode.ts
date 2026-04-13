import type { TenantWorkspaceContext } from "../../api/tenantPortal";

export type TenantWorkspaceMode =
  | "invite_mode"
  | "applicant_mode"
  | "active_tenant_mode";

export type TenantWorkspaceModeAction = {
  label: string;
  to: string;
};

export type TenantWorkspaceModeView = {
  mode: TenantWorkspaceMode;
  eyebrow: string;
  title: string;
  description: string;
  nextSteps: TenantWorkspaceModeAction[];
};

export function resolveTenantWorkspaceMode(
  context: TenantWorkspaceContext | null | undefined
): TenantWorkspaceMode {
  const authority = String(context?.authority || "").trim().toLowerCase();
  if (authority === "invite") return "invite_mode";
  if (
    authority === "active_tenant" ||
    context?.tenantId ||
    context?.leaseId
  ) {
    return "active_tenant_mode";
  }
  return "applicant_mode";
}

export function buildTenantWorkspaceModeView(
  context: TenantWorkspaceContext | null | undefined
): TenantWorkspaceModeView {
  const mode = resolveTenantWorkspaceMode(context);

  if (mode === "invite_mode") {
    return {
      mode,
      eyebrow: "Invite step",
      title: "You are completing your invite",
      description:
        "This workspace is set up for your invite step. Review the invite details and continue into your application when you're ready.",
      nextSteps: [
        { label: "Complete your invite", to: "/tenant/invite/redeem" },
        { label: "Review your application", to: "/tenant/application" },
      ],
    };
  }

  if (mode === "active_tenant_mode") {
    return {
      mode,
      eyebrow: "Active tenant workspace",
      title: "Your tenancy is active",
      description:
        "You're in your active tenant workspace now. Use this as your current tenancy home for lease details, documents, payments, and next-step visibility.",
      nextSteps: [
        { label: "Continue to your dashboard", to: "/tenant/dashboard" },
        { label: "Open lease details", to: "/tenant/lease" },
        { label: "Review documents", to: "/tenant/attachments" },
        { label: "Open payments", to: "/tenant/payments" },
      ],
    };
  }

  return {
    mode,
    eyebrow: "Application in progress",
    title: "Your application is in progress",
    description:
      "You're in the application workspace. Review the current checklist, update any missing details, and keep your file ready for review.",
    nextSteps: [
      { label: "Continue your application", to: "/tenant/application" },
      { label: "Review documents", to: "/tenant/attachments" },
      { label: "Review access", to: "/tenant/access" },
    ],
  };
}
