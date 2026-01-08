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
