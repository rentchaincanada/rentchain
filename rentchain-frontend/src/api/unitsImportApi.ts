import api from "./client";

export async function importUnitsCsv(
  propertyId: string,
  csvText: string,
  mode: "dryRun" | "strict" | "partial" = "partial"
) {
  const res = await api.post(
    `/api/properties/${propertyId}/units/import`,
    { csvText, mode },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
