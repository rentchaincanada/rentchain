// src/services/propertyOverviewApi.ts

export type RiskLevel = "Low" | "Medium" | "High" | "Unknown";

export interface PropertySummary {
  id: string;
  name: string;
  address: string;
}

export async function fetchProperties(): Promise<PropertySummary[]> {
  const res = await fetch(`${API_BASE_URL}/properties`);

  if (!res.ok) {
    throw new Error(
      `Failed to load properties (${res.status} ${res.statusText})`
    );
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    return data as PropertySummary[];
  }

  if (Array.isArray(data?.properties)) {
    return data.properties as PropertySummary[];
  }

  return [];
}
export interface PropertyOverviewKpis {
  occupancyRate: number;
  occupiedUnits: number;
  totalUnits: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  mtdOutstanding: number;
  collectionRate: number;
}

export interface PropertyOverviewUnit {
  unit: string;
  tenant: string | null;
  rent: number | null;
  status: string;
  leaseEnd: string | null;
  risk: RiskLevel;
}

export interface MaintenanceSummary {
  openTickets: number;
  recentActivity: any[];
  aiInsights: any | null;
}

export interface PropertyOverviewResponse {
  propertyId: string;
  name: string;
  address: string;
  kpis: PropertyOverviewKpis;
  units: PropertyOverviewUnit[];
  maintenanceSummary: MaintenanceSummary;
}

// ✅ Frontend only talks to backend via HTTP
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export async function fetchPropertyOverview(
  propertyId: string
): Promise<PropertyOverviewResponse> {
  const res = await fetch(
    `${API_BASE_URL}/properties/${encodeURIComponent(propertyId)}/overview`
  );

  if (!res.ok) {
    throw new Error(
      `Failed to load property overview (${res.status} ${res.statusText})`
    );
  }

  return (await res.json()) as PropertyOverviewResponse;
}
