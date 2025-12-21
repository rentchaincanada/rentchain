import { propertyService } from "./propertyService";
import { leaseService } from "./leaseService";
import { paymentsService } from "./paymentsService";

export interface DashboardKpis {
  totalProperties: number;
  totalUnits: number;
  occupancyRate: number; // 0-1
  monthlyRentRoll: number;
  monthlyCollected: number;
  monthlyDelinquent: number;
}

export interface DashboardProperty {
  id: string;
  name: string;
  city: string;
  units: number;
  occupiedUnits: number;
  occupancyRate: number;
  avgRent: number;
  risk?: string;
}

export interface DashboardOverview {
  kpis: DashboardKpis;
  properties: DashboardProperty[];
}

export async function getDashboardOverview(
  referenceDate?: Date
): Promise<DashboardOverview> {
  const today = referenceDate ?? new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12

  const properties = propertyService.getAll();
  const leases = leaseService.getAll();
  const activeLeases = leases.filter((l) => l.status === "active");

  const totalProperties = properties.length;
  const totalUnits = properties.reduce((sum, p) => sum + (p.totalUnits ?? 0), 0);
  const portfolioOccupiedUnits = activeLeases.length;
  const occupancyRate = totalUnits > 0 ? portfolioOccupiedUnits / totalUnits : 0;
  const monthlyRentRoll = activeLeases.reduce(
    (sum, l) => sum + (typeof l.monthlyRent === "number" ? l.monthlyRent : 0),
    0
  );

  const allTenantIds = Array.from(new Set(leases.map((l) => l.tenantId)));
  const monthlyCollected = paymentsService.getTotalForTenantsInMonth(
    allTenantIds,
    year,
    month
  );
  const monthlyDelinquent = Math.max(0, monthlyRentRoll - monthlyCollected);

  const propertiesSummary: DashboardProperty[] = properties.map((p) => {
    const propLeases = activeLeases.filter((l) => l.propertyId === p.id);
    const occupiedUnits = propLeases.length;
    const occRate = p.totalUnits > 0 ? occupiedUnits / p.totalUnits : 0;
    const avgRent =
      propLeases.length > 0
        ? propLeases.reduce((sum, l) => sum + l.monthlyRent, 0) /
          propLeases.length
        : 0;

    return {
      id: p.id,
      name: p.name,
      city: p.city,
      units: p.totalUnits,
      occupiedUnits,
      occupancyRate: occRate,
      avgRent,
      risk: "Low",
    };
  });

  return {
    kpis: {
      totalProperties,
      totalUnits,
      occupancyRate,
      monthlyRentRoll,
      monthlyCollected,
      monthlyDelinquent,
    },
    properties: propertiesSummary,
  };
}
