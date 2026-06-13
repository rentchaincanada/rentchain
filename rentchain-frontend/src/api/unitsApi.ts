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

function getStableUnitId(unit: UnitRecord | undefined) {
  const id = String(unit?.id || unit?.unitId || unit?.uid || "").trim();
  return id && !/^placeholder-/i.test(id) ? id : "";
}

function getRequestedOccupancyMetadata(unit: UnitInput | undefined) {
  const status = String(unit?.status || "").trim().toLowerCase();
  const occupantName = String(unit?.occupantName || unit?.tenantName || "").trim();
  const leaseEndDate = String(unit?.leaseEndDate || "").trim();

  if (status !== "occupied") return null;
  if (!occupantName && !leaseEndDate) return null;

  return {
    status: "occupied" as const,
    occupantName: occupantName || null,
    tenantName: occupantName || null,
    leaseEndDate: leaseEndDate || null,
  };
}

export async function patchCreatedUnitOccupancyMetadata(
  createdUnits: UnitRecord[],
  requestedUnits: UnitInput[]
): Promise<UnitRecord[]> {
  const units = Array.isArray(createdUnits) ? [...createdUnits] : [];

  for (let index = 0; index < units.length; index += 1) {
    const metadata = getRequestedOccupancyMetadata(requestedUnits[index]);
    if (!metadata) continue;

    const unitId = getStableUnitId(units[index]);
    if (!unitId) {
      const err = new Error("Saved occupied unit was not returned with a stable ID. Please try again.");
      (err as any).code = "UNIT_ID_UNRESOLVED";
      throw err;
    }

    const result: any = await updateUnit(unitId, metadata);
    const persisted = result?.unit || result?.item || result || {};
    units[index] = {
      ...units[index],
      ...metadata,
      ...persisted,
      id: getStableUnitId(persisted) || unitId,
    };
  }

  return units;
}

export async function uploadUnitLeaseDocument(unitId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch(`/units/${unitId}/lease-document`, {
    method: "POST",
    body: formData,
  });
}
