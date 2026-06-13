import { apiFetch } from "./apiFetch";

export type UnitInput = {
  unitNumber: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  marketRent?: number;
  status?: "vacant" | "occupied";
  occupantName?: string | null;
  tenantName?: string | null;
  leaseEndDate?: string | null;
};

export type UnitRecord = UnitInput & {
  id: string;
  propertyId?: string;
  unitId?: string;
  uid?: string;
};

export type AddUnitsManualResponse = {
  ok?: boolean;
  created?: number;
  units?: UnitRecord[];
  items?: UnitRecord[];
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

export async function addUnitsManual(propertyId: string, units: UnitInput[]): Promise<AddUnitsManualResponse> {
  return apiFetch(`/properties/${propertyId}/units`, {
    method: "POST",
    body: { units },
  }) as Promise<AddUnitsManualResponse>;
}

export async function updateUnit(unitId: string, payload: any) {
  return apiFetch(`/units/${unitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadUnitLeaseDocument(unitId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch(`/units/${unitId}/lease-document`, {
    method: "POST",
    body: formData,
  });
}
