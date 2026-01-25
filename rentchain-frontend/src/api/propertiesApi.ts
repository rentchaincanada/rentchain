import api from "./client";
import type { PropertyLedgerEntry } from "../types/ledger";

export interface UnitInput {
  unitNumber: string;
  rent: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  utilitiesIncluded?: string[];
}

export interface PropertyInput {
  name?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  totalUnits: number;
  amenities?: string[];
  units?: UnitInput[];
}

export interface PropertyUnit extends UnitInput {
  id: string;
  status?: "vacant" | "occupied";
}

export interface Property extends PropertyInput {
  id: string;
  createdAt: string;
  landlordId?: string;
  status?: "draft" | "active";
  units: PropertyUnit[];
  unitCount?: number;
  occupiedCount?: number;
  occupancyRate?: number;
}

export async function createProperty(
  payload: PropertyInput
): Promise<{ property: Property }> {
  const res = await api.post("/properties", payload);
  const data = res.data;
  const property = (data as any)?.property ?? (data as any);
  return { property } as { property: Property };
}

export async function fetchProperties(): Promise<{ properties: Property[] }> {
  const res = await api.get("/properties");
  return res.data;
}

export async function fetchPropertyLedger(
  propertyId: string
): Promise<PropertyLedgerEntry[]> {
  const res = await api.get(`/properties/${encodeURIComponent(propertyId)}/ledger`);
  return res.data as PropertyLedgerEntry[];
}

export async function importUnitsCsv(propertyId: string, csvText: string) {
  const res = await api.post(
    `/properties/${propertyId}/units/import`,
    { csvText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
