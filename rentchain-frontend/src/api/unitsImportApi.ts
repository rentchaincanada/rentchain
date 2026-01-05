import api from "./client";

export async function importUnitsCsv(
  propertyId: string,
  csvText: string,
  mode: "dryRun" | "strict" | "partial" = "partial",
  idempotencyKey?: string
) {
  console.log("[unitsImportApi] POST", `/properties/${propertyId}/units/import`, {
    mode,
    hasCsvText: !!csvText,
  });
  const res = await api.post(
    `/properties/${propertyId}/units/import`,
    { csvText, mode, idempotencyKey },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
