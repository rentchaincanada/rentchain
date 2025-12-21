const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export interface PortfolioKpis {
  propertiesCount: number;
  totalUnits: number;
  occupiedUnits: number;
  vacancyCount: number;
  occupancyRate: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  mtdOutstanding: number;
  collectionRate: number;
}

export interface PropertyPortfolioSummary {
  propertyId: string;
  name: string;
  address: string;
  totalUnits: number;
  occupiedUnits: number;
  vacancyCount: number;
  occupancyRate: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  collectionRate: number;
}

export interface PortfolioOverviewResponse {
  kpis: PortfolioKpis;
  properties: PropertyPortfolioSummary[];
}

export async function fetchPortfolioOverview(): Promise<PortfolioOverviewResponse> {
  const res = await fetch(`${API_BASE_URL}/portfolio/overview`);

  if (!res.ok) {
    throw new Error(
      `Failed to load portfolio overview (${res.status} ${res.statusText})`
    );
  }

  return (await res.json()) as PortfolioOverviewResponse;
}
