export function unitDocId(propertyId: string, unitNumber: string) {
  const clean = String(unitNumber).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `unit__${propertyId}__${clean}`.slice(0, 500);
}
