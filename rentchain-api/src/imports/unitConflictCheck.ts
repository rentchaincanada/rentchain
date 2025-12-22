import { db } from "../config/firebase";

export async function fetchExistingUnitNumbersForProperty(propertyId: string): Promise<Set<string>> {
  const existing = new Set<string>();
  const snap = await db
    .collection("units")
    .where("propertyId", "==", propertyId)
    .select("unitNumber")
    .get();

  snap.docs.forEach((d) => {
    const n = String((d.data() as any).unitNumber || "").trim();
    if (n) existing.add(n);
  });

  return existing;
}
