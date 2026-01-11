import { apiFetch } from "./apiFetch";

export type UnitInput = {
  unitNumber: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  marketRent?: number;
};

export async function fetchUnitsForProperty(propertyId: string) {
  // Primary endpoint
  const res: any = await apiFetch(`/properties/${propertyId}/units`, {
    method: "GET",
    allowStatuses: [404],
    suppressToasts: true,
  } as any);

  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.units)) return res.units;

  return [];
}

export async function addUnitsManual(propertyId: string, units: UnitInput[]) {
  return apiFetch(`/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify({ units }),
  });
}

export async function updateUnit(unitId: string, payload: any) {
  return apiFetch(`/units/${unitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
