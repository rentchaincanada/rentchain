import { apiFetch } from "./apiFetch";

export type ControlTowerResponse = {
  ok: true;
  today: {
    applicationsSubmitted: number;
    screeningsInitiated: number;
    leasesGenerated: number;
    depositsRecorded: number;
  };
  funnelMonthToDate: {
    applicationsReceived: number;
    creditReportsRun: number;
    applicationsApproved: number;
    leasesGenerated: number;
    screeningRate: number;
    approvalRate: number;
    leaseConversionRate: number;
  };
  utilization: {
    activeLandlords: number;
    activeProperties: number;
    activeUnits: number;
    applicationsPerUnit: number;
  };
  screening: {
    referralClicks: number;
    completedScreenings: number;
    screeningsPerLandlord: number;
    conversionRate: number;
  };
  financial: {
    depositsCollectedToday: number;
    depositsCollectedMonth: number;
    averageDepositAmount: number;
  };
  statusSummary: {
    website: string;
    api: string;
    screening: string;
    payments: string;
  };
  updatedAtMs: number;
};

export async function fetchControlTowerMetrics() {
  return apiFetch<ControlTowerResponse>("/admin/control-tower");
}
