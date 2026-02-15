import { apiFetch } from "./apiFetch";

export type AdminSummary = {
  revenue: {
    mtdGrossCents: number;
    mtdNetCents: number;
    ytdGrossCents: number;
    ytdNetCents: number;
    last30dGrossCents: number;
    last30dNetCents: number;
  };
  marketing: {
    last30dVisitors: number;
    last30dGetStartedClicks: number;
    last30dSeePricingClicks: number;
    last30dTemplateDownloads: number;
    last30dHelpSearches: number;
    ctaRatePricingToGetStarted: number;
  };
  expenses: {
    mtdCents: number;
    ytdCents: number;
  };
};

export type AdminMetrics = {
  activeSubscribers: number;
  mrrCents: number;
  arrCents: number;
  subscriptionsByTier: { starter: number; pro: number; business: number; elite: number };
  screeningsPaidThisMonth: number;
  screeningsPaidYtd: number;
  screeningRevenueCentsThisMonth: number;
  screeningRevenueCentsYtd: number;
  upgradesStartedThisMonth?: number;
  upgradesCompletedThisMonth?: number;
};

export type StripeHealth = {
  ok: boolean;
  stripeConfigured?: boolean;
};

export type AdminExpense = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amountCents: number;
  notes?: string | null;
};

export type AdminEventsSummary = {
  range: string;
  counts: Record<string, number>;
};

export async function fetchAdminSummary() {
  const data = await apiFetch<{
    ok: boolean;
    revenue: AdminSummary["revenue"];
    marketing: AdminSummary["marketing"];
    expenses: AdminSummary["expenses"];
  }>("/admin/summary");

  return {
    revenue: data.revenue,
    marketing: data.marketing,
    expenses: data.expenses,
  } as AdminSummary;
}

export async function fetchAdminEventsSummary(range: "day" | "week" | "month" = "month") {
  const data = await apiFetch<{ ok: boolean; range: string; counts: Record<string, number> }>(
    `/admin/events/summary?range=${encodeURIComponent(range)}`
  );
  return { range: data.range, counts: data.counts } as AdminEventsSummary;
}

export async function listAdminExpenses(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const url = query.toString() ? `/admin/expenses?${query.toString()}` : "/admin/expenses";
  const data = await apiFetch<{ ok: boolean; items: AdminExpense[] }>(url);
  return data.items || [];
}

export async function createAdminExpense(payload: Omit<AdminExpense, "id">) {
  const data = await apiFetch<{ ok: boolean; item: AdminExpense }>("/admin/expenses", {
    method: "POST",
    body: payload,
  });
  return data.item;
}

export async function fetchAdminMetrics() {
  const data = await apiFetch<{ ok: boolean; metrics: AdminMetrics }>("/admin/metrics");
  return data.metrics;
}

export async function fetchStripeHealth() {
  try {
    const data = await apiFetch<StripeHealth>("/health/stripe");
    return data;
  } catch {
    return null;
  }
}
