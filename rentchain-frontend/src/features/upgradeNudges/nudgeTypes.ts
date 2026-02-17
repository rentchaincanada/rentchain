export type NudgeType =
  | "FEATURE_TENANT_INVITES"
  | "FEATURE_APPLICATIONS"
  | "FEATURE_MESSAGING"
  | "FEATURE_LEDGER_BASIC"
  | "FEATURE_EXPORTS_BASIC"
  | "FEATURE_COMPLIANCE_REPORTS"
  | "FEATURE_LEDGER_VERIFIED"
  | "FEATURE_PORTFOLIO_DASHBOARD"
  | "FEATURE_TEAM_TOOLS"
  | "FEATURE_AI_SUMMARIES"
  | "FEATURE_EXPORTS_ADVANCED"
  | "FEATURE_AUDIT_LOGS"
  | "FEATURE_PORTFOLIO_ANALYTICS"
  | "GENERIC_UPGRADE";

export type NudgePresentation = "modal" | "banner" | "inline";

export type NudgeCopy = {
  type: NudgeType;
  title: string;
  body: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};

export const NUDGE_COPY: Record<NudgeType, NudgeCopy> = {
  FEATURE_TENANT_INVITES: {
    type: "FEATURE_TENANT_INVITES",
    title: "Unlock Tenant Invites",
    body: "Invite tenants to onboard digitally and keep records synced.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_APPLICATIONS: {
    type: "FEATURE_APPLICATIONS",
    title: "Unlock Applications",
    body: "Collect and manage rental applications in one workflow.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_MESSAGING: {
    type: "FEATURE_MESSAGING",
    title: "Unlock Messaging",
    body: "Message tenants and keep communication logged in one place.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_LEDGER_BASIC: {
    type: "FEATURE_LEDGER_BASIC",
    title: "Unlock Ledger",
    body: "Track rent and balances with a built-in ledger workflow.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_EXPORTS_BASIC: {
    type: "FEATURE_EXPORTS_BASIC",
    title: "Unlock Basic Exports",
    body: "Export operational data for accounting and reporting.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_COMPLIANCE_REPORTS: {
    type: "FEATURE_COMPLIANCE_REPORTS",
    title: "Unlock Compliance Reports",
    body: "Generate compliance-ready reports from your portfolio activity.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_LEDGER_VERIFIED: {
    type: "FEATURE_LEDGER_VERIFIED",
    title: "Unlock Verified Ledger",
    body: "Use verified ledger workflows for stronger audit confidence.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_PORTFOLIO_DASHBOARD: {
    type: "FEATURE_PORTFOLIO_DASHBOARD",
    title: "Unlock Portfolio Dashboard",
    body: "Monitor portfolio performance with pro-level dashboard views.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_TEAM_TOOLS: {
    type: "FEATURE_TEAM_TOOLS",
    title: "Unlock Team Tools",
    body: "Invite teammates and coordinate operations across your portfolio.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_AI_SUMMARIES: {
    type: "FEATURE_AI_SUMMARIES",
    title: "Unlock AI Summaries",
    body: "Generate concise AI summaries for faster portfolio reviews.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_EXPORTS_ADVANCED: {
    type: "FEATURE_EXPORTS_ADVANCED",
    title: "Unlock Advanced Exports",
    body: "Access advanced export formats for deeper analysis.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_AUDIT_LOGS: {
    type: "FEATURE_AUDIT_LOGS",
    title: "Unlock Audit Logs",
    body: "Track key actions with detailed audit trails.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_PORTFOLIO_ANALYTICS: {
    type: "FEATURE_PORTFOLIO_ANALYTICS",
    title: "Unlock Portfolio Analytics",
    body: "Use advanced analytics to monitor risk and performance trends.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  GENERIC_UPGRADE: {
    type: "GENERIC_UPGRADE",
    title: "Unlock more with an upgrade",
    body: "Upgrade your plan to access additional workflow capabilities.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
};

export function mapFeatureKeyToNudgeType(featureKey?: string | null): NudgeType {
  const key = String(featureKey || "").trim().toLowerCase();
  if (!key) return "GENERIC_UPGRADE";
  if (key === "tenant_invites") return "FEATURE_TENANT_INVITES";
  if (key === "applications") return "FEATURE_APPLICATIONS";
  if (key === "messaging") return "FEATURE_MESSAGING";
  if (key === "ledger_basic" || key === "ledger" || key === "leases") return "FEATURE_LEDGER_BASIC";
  if (key === "exports_basic" || key === "exports") return "FEATURE_EXPORTS_BASIC";
  if (key === "compliance_reports") return "FEATURE_COMPLIANCE_REPORTS";
  if (key === "ledger_verified") return "FEATURE_LEDGER_VERIFIED";
  if (key === "portfolio_dashboard") return "FEATURE_PORTFOLIO_DASHBOARD";
  if (key === "team.invites") return "FEATURE_TEAM_TOOLS";
  if (key === "ai_summaries" || key === "ai.insights" || key === "ai.summary") return "FEATURE_AI_SUMMARIES";
  if (key === "exports_advanced") return "FEATURE_EXPORTS_ADVANCED";
  if (key === "audit_logs") return "FEATURE_AUDIT_LOGS";
  if (key === "portfolio_analytics" || key === "portfolio.ai") return "FEATURE_PORTFOLIO_ANALYTICS";
  return "GENERIC_UPGRADE";
}

export function mapLimitCodeToNudgeType(limitCode?: string | null): NudgeType {
  return "GENERIC_UPGRADE";
}
