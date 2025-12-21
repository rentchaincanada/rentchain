// src/services/tenantOverviewService.ts

export type TenantOverviewRow = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  onTimePayments: number;
  latePayments: number;
};

// For now: static mock data from backend (can later be replaced by Firestore)
const MOCK_TENANTS: TenantOverviewRow[] = [
  {
    id: "T001",
    name: "Alex Johnson",
    propertyName: "Main St. Apartments",
    unitLabel: "Unit 203",
    monthlyRent: 1450,
    onTimePayments: 11,
    latePayments: 1,
  },
  {
    id: "T002",
    name: "Maria Lopez",
    propertyName: "Downtown Lofts",
    unitLabel: "Unit 504",
    monthlyRent: 1650,
    onTimePayments: 9,
    latePayments: 3,
  },
  {
    id: "T003",
    name: "Jordan Patel",
    propertyName: "Riverside Townhomes",
    unitLabel: "Unit 11B",
    monthlyRent: 1725,
    onTimePayments: 7,
    latePayments: 5,
  },
];

export async function getTenantOverview(): Promise<TenantOverviewRow[]> {
  // 🔜 Later: replace this with Firestore query / aggregation
  return MOCK_TENANTS;
}
