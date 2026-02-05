import { apiFetch, apiJson } from "@/lib/apiClient";
import { apiGetJson } from "./http";

export type BillingRecord = {
  id: string;
  landlordId: string;
  provider: string;
  type: string;
  kind?: string;
  amountCents: number;
  totalAmountCents?: number;
  currency: string;
  description: string;
  status: "paid" | "pending" | "failed";
  receiptUrl?: string | null;
  createdAt: string;
  screeningTier?: "basic" | "verify" | "verify_ai";
  addons?: string[];
};

export async function fetchBillingHistory(): Promise<BillingRecord[]> {
  try {
    const res = await apiGetJson<any>("/billing", { allowStatuses: [404, 501] });
    if (!res.ok) return [];
    const data = res.data;
    if (Array.isArray(data)) return data as BillingRecord[];
    if (Array.isArray(data?.items)) return data.items as BillingRecord[];
    if (Array.isArray(data?.records)) return data.records as BillingRecord[];
    return [];
  } catch {
    return [];
  }
}

export interface SubscriptionStatus {
  planId: "free" | "pro" | "enterprise";
  status: "active" | "past_due" | "canceled";
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const res = await apiGetJson<any>("/billing/subscription-status", { allowStatuses: [404, 501] });
    if (!res.ok) {
      return { planId: "free", status: "canceled" } as SubscriptionStatus;
    }
    const data = res.data;
    return (data?.subscription ?? data) as SubscriptionStatus;
  } catch {
    return { planId: "free", status: "canceled" } as SubscriptionStatus;
  }
}

export async function createCheckoutSession(): Promise<{ checkoutUrl: string }> {
  const data = await apiJson<any>("/billing/create-checkout-session", {
    method: "POST",
  });
  return { checkoutUrl: data?.checkoutUrl ?? "" };
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  const data = await apiJson<any>("/billing/portal", { method: "POST" });
  return { url: data?.url ?? "" };
}

export async function simulateCreditPull(
  tenantId: string
): Promise<{ reportId: string; message: string }> {
  const res = await apiFetch("/credit/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(text || `Failed to simulate credit pull: ${res.status}`);
  }

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return {
    reportId: data?.reportId ?? "mock-report-id",
    message: data?.message ?? "Credit pull simulated.",
  };
}

export type BillingPlanPricing = {
  key: "starter" | "pro" | "business";
  label: string;
  currency: string;
  monthlyAmountCents: number;
  yearlyAmountCents: number;
};

export type BillingPricingResponse = {
  ok: true;
  plans: BillingPlanPricing[];
  screening?: {
    basicCents: number;
    verifyCents: number;
    verifyAiCents: number;
    creditScoreCents: number;
    expeditedCents: number;
    currency: string;
  };
  env?: "live" | "test";
};

export async function fetchBillingPricing(): Promise<BillingPricingResponse | null> {
  try {
    const res = await apiFetch<any>("/billing/pricing", { method: "GET" });
    if (!res?.ok) return null;
    return res as BillingPricingResponse;
  } catch {
    return null;
  }
}

export type PricingHealth = {
  ok: boolean;
  stripeConfigured?: boolean;
  planPricesConfigured?: boolean;
  missing?: string[];
  invalid?: string[];
  env?: "live" | "test";
};

export async function fetchPricingHealth(): Promise<PricingHealth | null> {
  try {
    const res = await apiGetJson<any>("/health/pricing", { allowStatuses: [404, 501] });
    if (!res.ok) return null;
    return res.data as PricingHealth;
  } catch {
    return null;
  }
}
