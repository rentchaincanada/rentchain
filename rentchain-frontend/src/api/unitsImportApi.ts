import api from "./client";

export async function importUnitsCsv(propertyId: string, csvText: string) {
  const res = await api.post(
    `/api/properties/${propertyId}/units/import`,
    { csvText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
