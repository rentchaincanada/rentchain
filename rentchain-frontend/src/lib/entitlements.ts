import { apiFetch } from "@/lib/apiClient";
import { normalizePlan, type Plan } from "@/lib/plan";

export type CapabilitiesResponse = {
  ok?: boolean;
  plan?: Plan | string;
  features: Record<string, boolean>;
  ts?: number;
};

export const DEFAULT_CAPABILITIES: CapabilitiesResponse = {
  ok: true,
  plan: "free",
  features: {
    properties: true,
    units: true,
    tenants_manual: true,
    applications_manual: true,
    screening: true,
    screening_pay_per_use: true,
    screening_history: true,
    messaging: false,
    tenant_invites: false,
    tenantInvites: false,
    applications: false,
    ledger_basic: false,
    ledger_verified: false,
    move_in_readiness: false,
    work_orders: false,
    pdf_export: false,
    review_summary: false,
    exports_basic: false,
    exports_advanced: false,
    compliance_reports: false,
    portfolio_dashboard: false,
    portfolio_analytics: false,
    ai_summaries: false,
    tenantPdfReport: false,
  },
};

let cachedCapabilities: CapabilitiesResponse | null = null;

export function getCachedCapabilities(): CapabilitiesResponse | null {
  return cachedCapabilities;
}

export function setCachedCapabilities(next: CapabilitiesResponse) {
  cachedCapabilities = {
    ...next,
    plan: normalizePlan(next?.plan),
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("capabilities:updated", { detail: cachedCapabilities }));
  }
}

export async function refreshEntitlements(
  updateUser?: (patch: Record<string, any>) => void
): Promise<void> {
  try {
    const me = await apiFetch<{ ok?: boolean; user?: any }>("/me");
    if (me?.user && updateUser) {
      updateUser(me.user);
    }
  } catch {
    // ignore auth refresh failures
  }

  try {
    const caps = await apiFetch<CapabilitiesResponse>("/capabilities");
    if (caps && typeof caps === "object") {
      setCachedCapabilities({
        ok: caps.ok,
        plan: normalizePlan(caps.plan),
        features: caps.features || {},
        ts: caps.ts,
      });
    }
  } catch {
    setCachedCapabilities(DEFAULT_CAPABILITIES);
  }
}
