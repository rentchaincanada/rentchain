export type UpgradePromptDetail = {
  featureKey: string;
  currentPlan?: string;
  requiredPlan?: string;
  source?: string;
  redirectTo?: string;
};

const PLAN_ORDER = ["screening", "starter", "core", "pro", "elite"] as const;

const FEATURE_REQUIRED_PLAN: Record<string, string> = {
  screening: "screening",
  applications: "starter",
  application_links: "starter",
  unitstable: "starter",
  units: "starter",
  properties: "starter",
  leases: "starter",
  maintenance: "starter",
  notices: "starter",
  tenantportal: "starter",
  messaging: "pro",
  ledger: "pro",
  exports: "pro",
  "ai.insights": "pro",
  "ai.summary": "pro",
  "portfolio.ai": "pro",
};

export function normalizePlanName(input?: any): string | undefined {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (PLAN_ORDER.includes(raw as (typeof PLAN_ORDER)[number])) return raw;
  if (raw === "core") return "core";
  return undefined;
}

export function resolveRequiredPlan(featureKey?: string, currentPlan?: string): string | undefined {
  const key = String(featureKey ?? "").trim().toLowerCase();
  if (!key) return undefined;
  const required = FEATURE_REQUIRED_PLAN[key];
  if (required) return required;
  const current = normalizePlanName(currentPlan);
  if (!current) return undefined;
  const idx = PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number]);
  if (idx >= 0 && idx < PLAN_ORDER.length - 1) return PLAN_ORDER[idx + 1];
  return current;
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
    payload?.resource;
  if (!raw) return undefined;
  return String(raw).trim();
}

function inferFeatureKeyFromMessage(payload: any): string | undefined {
  const message = String(payload?.message ?? payload?.error ?? "").toLowerCase();
  if (!message) return undefined;
  if (message.includes("properties")) return "properties";
  if (message.includes("units")) return "units";
  if (message.includes("leases")) return "leases";
  if (message.includes("tenants")) return "tenants";
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

export function dispatchUpgradePrompt(detail: UpgradePromptDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("upgrade:prompt", { detail }));
  } catch {
    // ignore dispatch errors
  }
}

export function maybeDispatchUpgradePrompt(payload: any, status?: number): UpgradePromptDetail | null {
  const detail = getUpgradePromptDetail(payload, status);
  if (detail) dispatchUpgradePrompt(detail);
  return detail;
}
