// src/services/dashboardPropertiesService.ts


import { apiJson } from "../lib/apiClient";

export type DashboardProperty = {
  id: string;
  name: string;
  city: string;
  units: number;
  occupiedUnits?: number;
  occupancyRate?: number; // 0–1 or 0–100
  avgRent?: number;
  risk?: string;
};

/**
 * Fetches dashboard properties from /dashboard/overview
 * and normalizes them into DashboardProperty[]
 */
export async function fetchDashboardProperties(): Promise<DashboardProperty[]> {
  const data = await apiJson<any>("/dashboard/overview");

  const rawProps = (data && (data.properties || data.props || [])) as any[];

  // Normalize different possible backend shapes into one clean type
  return rawProps.map((p, idx) => ({
    id: p.id ?? p.propertyId ?? `prop-${idx}`,
    name: p.name ?? p.propertyName ?? "Unknown property",
    city: p.city ?? p.location ?? "-",
    units: p.units ?? p.totalUnits ?? 0,
    occupiedUnits:
      p.occupiedUnits ?? p.occupied ?? p.unitsOccupied ?? undefined,
    occupancyRate:
      p.occupancyRate ?? p.occupancy ?? p.occupancyPercent ?? undefined,
    avgRent: p.avgRent ?? p.averageRent ?? p.avgMonthlyRent ?? undefined,
    risk: p.risk ?? p.riskLevel ?? p.riskLabel ?? undefined,
  }));
}
