import { apiFetch } from "./apiFetch";

export type TuReferralChartPoint = {
  day: string;
  initiated: number;
  completed: number;
};

export type TuReferralChartTotals = {
  referralClicks: number;
  completedScreenings: number;
  activeLandlords: number;
  screeningsPerLandlord: number;
  conversionRate: number;
};

export type TuReferralChartResponse = {
  ok: true;
  month: string;
  totals: TuReferralChartTotals;
  series: TuReferralChartPoint[];
};

export async function getTuReferralChart(month: string) {
  const normalized = String(month || "").trim();
  const query = normalized ? `?month=${encodeURIComponent(normalized)}` : "";
  return apiFetch<TuReferralChartResponse>(`/admin/metrics/tu-referrals/chart${query}`);
}
