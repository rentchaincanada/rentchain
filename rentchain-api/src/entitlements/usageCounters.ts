import { db } from "../config/firebase";

export async function countPropertiesForLandlord(landlordId: string): Promise<number> {
  const snap = await db.collection("properties").where("landlordId", "==", landlordId).get();
  return snap.size;
}

export async function countUnitsForLandlord(landlordId: string): Promise<number> {
  const snap = await db.collection("properties").where("landlordId", "==", landlordId).get();
  if (snap.empty) return 0;

  return snap.docs.reduce((sum, doc) => {
    const data = doc.data() as any;
    const units = Number(data?.unitCount ?? 0);
    return sum + (Number.isFinite(units) ? units : 0);
  }, 0);
}
