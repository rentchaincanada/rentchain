import { apiFetch, apiJson } from "@/lib/apiClient";

export type BillingRecord = {
  id: string;
  landlordId: string;
  provider: string;
  type: string;
  amountCents: number;
  currency: string;
  description: string;
  status: "paid" | "pending" | "failed";
  receiptUrl?: string | null;
  createdAt: string;
};

export async function fetchBillingHistory(): Promise<BillingRecord[]> {
  const data = await apiJson<any>("/billing");
  if (Array.isArray(data)) return data as BillingRecord[];
  if (Array.isArray(data?.items)) return data.items as BillingRecord[];
  return [];
}

export interface SubscriptionStatus {
  planId: "free" | "pro" | "enterprise";
  status: "active" | "past_due" | "canceled";
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const data = await apiJson<any>("/billing/subscription-status");
  return (data?.subscription ?? data) as SubscriptionStatus;
}

export async function createCheckoutSession(): Promise<{ checkoutUrl: string }> {
  const data = await apiJson<any>("/billing/create-checkout-session", {
    method: "POST",
  });
  return { checkoutUrl: data?.checkoutUrl ?? "" };
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
