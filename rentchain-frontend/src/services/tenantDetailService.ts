// src/services/tenantDetailService.ts

import type { TenantDetailsModel } from "../components/tenants/TenantDetails";

const MOCK_TENANT_DETAILS: Record<string, TenantDetailsModel> = {
  t1: {
    id: "t1",
    name: "John Smith",
    propertyName: "Main St. Apartments",
    unit: "101",
    monthlyRent: 1450,
    email: "john.smith@example.com",
    phone: "(902) 555-1001",
    leaseStart: "2023-01-01",
    leaseEnd: "2024-12-31",
    status: "Current",
    currentBalance: 0,
    riskLevel: "Low",
    notes: "Consistently on-time payments.",
  },
  t2: {
    id: "t2",
    name: "Sarah Johnson",
    propertyName: "Downtown Lofts",
    unit: "204",
    monthlyRent: 1650,
    email: "sarah.johnson@example.com",
    phone: "(902) 555-2002",
    leaseStart: "2024-03-01",
    leaseEnd: "2025-02-28",
    status: "Current",
    currentBalance: 320.5,
    riskLevel: "Medium",
    notes: "One late payment due to job transition.",
  },
  t3: {
    id: "t3",
    name: "Mike Lee",
    propertyName: "Main St. Apartments",
    unit: "302",
    monthlyRent: 1400,
    email: "mike.lee@example.com",
    phone: "(902) 555-3003",
    leaseStart: "2022-06-01",
    leaseEnd: "2023-05-31",
    status: "Former",
    currentBalance: -120,
    riskLevel: "Low",
    notes: "Moved out with credit remaining.",
  },
  alex203: {
    id: "alex203",
    name: "Alex Johnson",
    propertyName: "Main St. Apartments",
    unit: "203",
    monthlyRent: 1500,
    email: "alex.johnson@example.com",
    phone: "(902) 555-4004",
    leaseStart: "2024-01-01",
    leaseEnd: "2024-12-31",
    status: "Current",
    currentBalance: 0,
    riskLevel: "Low",
    notes: "Legacy mock tenant from early UI.",
  },
};

// Helper: turn "t-alex-johnson" → "Alex Johnson"
const prettyNameFromId = (tenantId: string): string => {
  const slug = tenantId.replace(/^t[-_]/i, ""); // drop leading "t-" or "t_"
  const words = slug.split(/[-_]/g);
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export const getTenantDetails = async (
  tenantId: string
): Promise<TenantDetailsModel> => {
  const known = MOCK_TENANT_DETAILS[tenantId];

  if (known) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(known), 150);
    });
  }

  // Fallback: build a decent-looking tenant from the ID
  const fallback: TenantDetailsModel = {
    id: tenantId,
    name: prettyNameFromId(tenantId),              // 👈 now "Alex Johnson"
    propertyName: "Unknown property",
    unit: "—",
    monthlyRent: undefined,
    email: undefined,
    phone: undefined,
    leaseStart: undefined,
    leaseEnd: undefined,
    status: "Current",
    currentBalance: 0,
    riskLevel: "Medium",
    notes:
      "No detailed record found for this tenant ID yet. This is placeholder data.",
  };

  return new Promise((resolve) => {
    setTimeout(() => resolve(fallback), 150);
  });
};

const tenantDetailService = {
  getTenantDetails,
};

export default tenantDetailService;
