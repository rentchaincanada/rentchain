// @ts-nocheck
// src/state/demoTenants.ts
import { Tenant } from "../components/tenants/TenantDetailPanel";

export const demoTenants: Tenant[] = [
  {
    id: "t1",
    name: "Alice Johnson",
    unit: "101",
    propertyName: "Main St. Apartments",
    status: "Current",
    email: "alice@example.com",
    phone: "555-123-4567",
    monthlyRent: 1500,
  },
  {
    id: "t2",
    name: "Brian Chen",
    unit: "204",
    propertyName: "Downtown Lofts",
    status: "Current",
    email: "brian@example.com",
    phone: "555-234-5678",
    monthlyRent: 1650,
  },
  {
    id: "t3",
    name: "Carmen Diaz",
    unit: "305",
    propertyName: "Harbour View",
    status: "Notice",
    email: "carmen@example.com",
    phone: "555-345-6789",
    monthlyRent: 1800,
  },
];
