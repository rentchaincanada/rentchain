import api from "./client";

export async function importUnitsCsv(propertyId: string, file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await api.post(`/properties/${propertyId}/units/import`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
