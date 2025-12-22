import { db, FieldValue } from "../config/firebase";

export type LandlordUsage = {
  properties: number;
  units: number;
  updatedAt?: any;
};

export async function getUsage(landlordId: string): Promise<LandlordUsage> {
  const ref = db.collection("landlordUsage").doc(landlordId);
  const snap = await ref.get();
  if (!snap.exists) {
    const init: LandlordUsage = {
      properties: 0,
      units: 0,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(init, { merge: true });
    return { properties: 0, units: 0 };
  }
  const data = snap.data() as any;
  return {
    properties: Number(data?.properties || 0),
    units: Number(data?.units || 0),
  };
}

export async function bumpUsage(
  landlordId: string,
  delta: { properties?: number; units?: number }
) {
  const ref = db.collection("landlordUsage").doc(landlordId);
  const update: any = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof delta.properties === "number") {
    update.properties = FieldValue.increment(delta.properties);
  }
  if (typeof delta.units === "number") {
    update.units = FieldValue.increment(delta.units);
  }
  await ref.set(update, { merge: true });
}
