export type NudgeType =
  | "LIMIT_TENANTS"
  | "FEATURE_TEMPLATES_PREMIUM"
  | "FEATURE_EXPORT_CSV"
  | "FEATURE_AI_INSIGHTS"
  | "FEATURE_SCREENING_AUTOMATION"
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
  LIMIT_TENANTS: {
    type: "LIMIT_TENANTS",
    title: "Tenant limit reached",
    body: "Upgrade to invite and manage more tenants without interruption.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_TEMPLATES_PREMIUM: {
    type: "FEATURE_TEMPLATES_PREMIUM",
    title: "Unlock premium templates",
    body: "Get advanced templates for notices, workflows, and operations on higher plans.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_EXPORT_CSV: {
    type: "FEATURE_EXPORT_CSV",
    title: "Unlock exports",
    body: "Upgrade to export your data for accounting, reporting, and compliance workflows.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_AI_INSIGHTS: {
    type: "FEATURE_AI_INSIGHTS",
    title: "Unlock AI insights",
    body: "Upgrade for AI-powered risk and portfolio insights to act faster.",
    primaryCtaLabel: "Upgrade",
    secondaryCtaLabel: "Not now",
  },
  FEATURE_SCREENING_AUTOMATION: {
    type: "FEATURE_SCREENING_AUTOMATION",
    title: "Unlock screening automation",
    body: "Upgrade to automate advanced screening workflows and reduce manual steps.",
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
  if (key.includes("tenant")) return "LIMIT_TENANTS";
  if (key.includes("template")) return "FEATURE_TEMPLATES_PREMIUM";
  if (key.includes("export")) return "FEATURE_EXPORT_CSV";
  if (key.includes("ai")) return "FEATURE_AI_INSIGHTS";
  if (key.includes("screening")) return "FEATURE_SCREENING_AUTOMATION";
  return "GENERIC_UPGRADE";
}

export function mapLimitCodeToNudgeType(limitCode?: string | null): NudgeType {
  const code = String(limitCode || "").trim().toUpperCase();
  if (code === "LIMIT_TENANTS") return "LIMIT_TENANTS";
  return "GENERIC_UPGRADE";
}
