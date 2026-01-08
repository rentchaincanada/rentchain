import { apiFetch } from "./apiFetch";

export async function fetchUnitsForProperty(propertyId: string) {
  // Try common endpoints; return the first successful array
  try {
    const res: any = await apiFetch(`/api/properties/${propertyId}/units`, {
      method: "GET",
      allowStatuses: [404],
      suppressToasts: true,
    } as any);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (!msg.includes("404")) throw e;
  }

  try {
    const res: any = await apiFetch(`/api/units?propertyId=${encodeURIComponent(propertyId)}`, {
      method: "GET",
      allowStatuses: [404],
      suppressToasts: true,
    } as any);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (!msg.includes("404")) throw e;
  }

  return null;
}

export async function addUnitsManual(args: {
  propertyId: string;
  units: Array<{
    label?: string;
    unitNumber?: string;
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    rentCents?: number;
    notes?: string;
  }>;
}) {
  const { propertyId, units } = args;

  try {
    return await apiFetch(`/api/properties/${propertyId}/units`, {
      method: "POST",
      body: JSON.stringify({ units }),
    } as any);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (!msg.includes("404")) throw e;
  }

  try {
    return await apiFetch(`/api/units`, {
      method: "POST",
      body: JSON.stringify({ propertyId, units }),
    } as any);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (!msg.includes("404")) throw e;
  }

  throw new Error("UNITS_CREATE_NOT_IMPLEMENTED");
}
