import { db } from "../config/firebase";

export async function reconcileLandlordUsage(landlordId: string) {
  const propsSnap = await db.collection("properties").where("landlordId", "==", landlordId).get();
  const unitsSnap = await db.collection("units").where("landlordId", "==", landlordId).get();

  const properties = propsSnap.size;
  const units = unitsSnap.size;

  await db
    .collection("landlordUsage")
    .doc(landlordId)
    .set({ properties, units, updatedAt: new Date() }, { merge: true });

  return { landlordId, properties, units };
}
