import { CANONICAL_PLAN_ORDER, normalizePlan, planLabel } from "@/lib/plan";

export type UpgradePromptDetail = {
  featureKey: string;
  currentPlan?: string;
  requiredPlan?: string;
  source?: string;
  redirectTo?: string;
};

const FEATURE_REQUIRED_PLAN: Record<string, string> = {
  applications_manual: "free",
  tenants_manual: "free",
  screening: "free",
  screening_pay_per_use: "free",
  screening_history: "free",
  screening_workflow: "starter",
  unitstable: "free",
  units: "free",
  properties: "free",
  tenant_invites: "starter",
  applications: "starter",
  application_links: "starter",
  leases: "starter",
  maintenance: "starter",
  move_in_readiness: "starter",
  work_orders: "starter",
  notices: "starter",
  tenantportal: "starter",
  messaging: "starter",
  ledger_basic: "starter",
  ledger_verified: "pro",
  ledger: "starter",
  "team.invites": "pro",
  portfolio_health_summary: "free",
  portfolio_score: "pro",
  portfolio_action_recommendations: "elite",
  portfolio_dashboard: "pro",
  review_summary: "pro",
  pdf_export: "pro",
  exports_basic: "pro",
  exports_advanced: "elite",
  exports: "pro",
  compliance_reports: "pro",
  audit_logs: "elite",
  ai_summaries: "elite",
  "ai.insights": "elite",
  "ai.summary": "elite",
  portfolio_analytics: "elite",
  "portfolio.ai": "elite",
};

export function normalizePlanName(input?: any): string | undefined {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  return normalizePlan(raw);
}

export function resolveRequiredPlan(featureKey?: string, currentPlan?: string): string | undefined {
  const key = String(featureKey ?? "").trim().toLowerCase();
  if (!key) return undefined;
  const required = FEATURE_REQUIRED_PLAN[key];
  if (required) return required;
  const current = normalizePlanName(currentPlan);
  if (!current) return "pro";
  const idx = CANONICAL_PLAN_ORDER.indexOf(current as (typeof CANONICAL_PLAN_ORDER)[number]);
  if (idx >= 0 && idx < CANONICAL_PLAN_ORDER.length - 1) return CANONICAL_PLAN_ORDER[idx + 1];
  return current || "pro";
}

export function resolveRequiredPlanLabel(featureKey?: string, currentPlan?: string): string | undefined {
  const requiredPlan = resolveRequiredPlan(featureKey, currentPlan);
  if (!requiredPlan) return undefined;
  return planLabel(normalizePlan(requiredPlan));
}

function extractPlanFromPayload(payload: any): string | undefined {
  return (
    normalizePlanName(payload?.plan) ||
    normalizePlanName(payload?.currentPlan) ||
    normalizePlanName(payload?.details?.plan) ||
    normalizePlanName(payload?.limits?.plan)
  );
}

function normalizeFeatureKey(payload: any): string | undefined {
  const raw =
    payload?.featureKey ||
    payload?.capability ||
    payload?.feature ||
    payload?.limitType ||
    payload?.resource ||
    payload?.code;
  if (!raw) return undefined;
  return String(raw).trim();
}

function inferFeatureKeyFromMessage(payload: any): string | undefined {
  const message = String(payload?.message ?? payload?.error ?? "").toLowerCase();
  if (!message) return undefined;
  if (message.includes("messaging")) return "messaging";
  if (message.includes("application")) return "applications";
  if (message.includes("invite")) return "tenant_invites";
  if (message.includes("ledger")) return "ledger_basic";
  if (message.includes("export")) return "exports_basic";
  if (message.includes("compliance")) return "compliance_reports";
  if (message.includes("audit")) return "audit_logs";
  if (message.includes("analytics")) return "portfolio_analytics";
  return undefined;
}

function isUpgradeRequiredPayload(payload: any, status?: number): boolean {
  const code = String(payload?.code ?? "").toUpperCase();
  const error = String(payload?.error ?? "").toLowerCase();
  const message = String(payload?.message ?? "").toLowerCase();

  if (code === "PLAN_LIMIT_EXCEEDED" || code === "PLAN_LIMIT_REACHED") return true;
  if (code === "LIMIT_REACHED" || code === "ENTITLEMENT_LIMIT_REACHED") return true;
  if (error === "plan_limit" || error === "plan_limit_reached") return true;
  if (error === "upgrade required" || payload?.upgradeRequired === true) return true;
  if (message.includes("plan limit")) return true;
  if ((status === 402 || status === 403 || status === 409) && error.includes("upgrade")) return true;
  return false;
}

export function getUpgradePromptDetail(payload: any, status?: number): UpgradePromptDetail | null {
  if (!payload) return null;
  if (!isUpgradeRequiredPayload(payload, status)) return null;

  const featureKey = normalizeFeatureKey(payload);
  const resolvedFeatureKey = featureKey || inferFeatureKeyFromMessage(payload);
  if (!resolvedFeatureKey) return null;

  const currentPlan = extractPlanFromPayload(payload);
  const requiredPlan =
    normalizePlanName(payload?.requiredPlan) || resolveRequiredPlan(resolvedFeatureKey, currentPlan);

  const source =
    String(payload?.source || payload?.context || payload?.detail?.source || payload?.meta?.source || "")
      .trim() || undefined;
  const redirectTo =
    String(
      payload?.redirectTo ||
        payload?.detail?.redirectTo ||
        payload?.meta?.redirectTo ||
        ""
    ).trim() || undefined;

  return { featureKey: resolvedFeatureKey, currentPlan, requiredPlan, source, redirectTo };
}

export function normalizeUpgradePromptDetail(detail: UpgradePromptDetail | null | undefined): UpgradePromptDetail | null {
  if (!detail) return null;

  const featureKey = normalizeFeatureKey(detail);
  if (!featureKey) return null;

  const currentPlan = normalizePlanName(detail.currentPlan);
  const requiredPlan =
    normalizePlanName(detail.requiredPlan) || resolveRequiredPlan(featureKey, currentPlan);
  const source = String(detail.source || "").trim() || undefined;
  const redirectTo = String(detail.redirectTo || "").trim() || undefined;

  return {
    featureKey,
    currentPlan,
    requiredPlan,
    source,
    redirectTo,
  };
}

export function dispatchUpgradePrompt(detail: UpgradePromptDetail) {
  if (typeof window === "undefined") return;
  const normalizedDetail = normalizeUpgradePromptDetail(detail);
  if (!normalizedDetail) return;
  try {
    window.dispatchEvent(new CustomEvent("upgrade:prompt", { detail: normalizedDetail }));
  } catch {
    // ignore dispatch errors
  }
}

export function maybeDispatchUpgradePrompt(payload: any, status?: number): UpgradePromptDetail | null {
  const detail = getUpgradePromptDetail(payload, status);
  if (detail) dispatchUpgradePrompt(detail);
  return detail;
}
