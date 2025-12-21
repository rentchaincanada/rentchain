import { apiJson } from "../lib/apiClient";

export type UnitInput = {
  unitNumber: string;
  beds: number;
  baths: number;
  sqft: number;
  marketRent: number;
  status?: "vacant" | "occupied";
};

export function addUnitsManual(propertyId: string, units: UnitInput[]) {
  return apiJson(`/properties/${propertyId}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ units }),
  });
}
