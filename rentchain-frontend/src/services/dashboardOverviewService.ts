// src/services/dashboardOverviewService.ts

import { apiJson } from "../lib/apiClient";

export type PropertySummary = {
  id: string;
  name: string;
  city: string;
  units: number;
  occupiedUnits: number;
  occupancyRate: number; // 0–1
  avgRent: number;
  risk: "Low" | "Medium" | "High";
};

export type TenantRiskRow = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  onTimePayments: number;
  latePayments: number;
  riskLevel: "Low" | "Medium" | "High";
  rentChainScore: number;
};

export type TimeSeriesPoint = {
  label: string;
  value: number;
};

export type PaymentBreakdown = {
  onTime: number;
  gracePeriod: number;
  late: number;
  veryLate: number;
};

export type DashboardOverview = {
  kpis: {
    totalProperties: number;
    totalUnits: number;
    occupancyRate: number; // 0–1
    monthlyRentRoll: number;
    monthlyCollected: number;
    monthlyDelinquent: number;
  };
  properties: PropertySummary[];
  tenantRisk: TenantRiskRow[];
  rentCollectionSeries: TimeSeriesPoint[];
  applicationsSeries: TimeSeriesPoint[];
  paymentBreakdown: PaymentBreakdown;
};

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return apiJson<DashboardOverview>("/dashboard/overview");
}
