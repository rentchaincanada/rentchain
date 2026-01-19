import { apiJson } from "../lib/apiClient";

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

export type AdminExpense = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amountCents: number;
  notes?: string | null;
};

export async function fetchAdminSummary() {
  const data = await apiJson<{ ok: boolean; revenue: AdminSummary["revenue"]; marketing: AdminSummary["marketing"]; expenses: AdminSummary["expenses"] }>(
    "/admin/summary"
  );
  return {
    revenue: data.revenue,
    marketing: data.marketing,
    expenses: data.expenses,
  } as AdminSummary;
}

export async function listAdminExpenses(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const url = query.toString() ? `/admin/expenses?${query.toString()}` : "/admin/expenses";
  const data = await apiJson<{ ok: boolean; items: AdminExpense[] }>(url);
  return data.items || [];
}

export async function createAdminExpense(payload: Omit<AdminExpense, "id">) {
  const data = await apiJson<{ ok: boolean; item: AdminExpense }>("/admin/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.item;
}
