import { getFirestore } from "firebase-admin/firestore";

export type UnitUpsert = {
  landlordId: string;
  propertyId: string;
  unitNumber: string;
  beds: number;
  baths: number;
  sqft: number;
  marketRentCents: number;
  status: "vacant" | "occupied" | "notice" | "offline";
  createdAt: string;
  updatedAt: string;
};

const db = getFirestore();
const COL = "units";

function unitDocId(propertyId: string, unitNumber: string) {
  return `${propertyId}__${unitNumber}`;
}

export async function countUnitsForProperty(
  landlordId: string,
  propertyId: string
) {
  const snap = await db
    .collection(COL)
    .where("landlordId", "==", landlordId)
    .where("propertyId", "==", propertyId)
    .count()
    .get();

  return (snap.data().count as number) || 0;
}

export async function upsertUnit(u: UnitUpsert) {
  const ref = db.collection(COL).doc(unitDocId(u.propertyId, u.unitNumber));
  const existing = await ref.get();

  await ref.set(u, { merge: true });

  return { created: !existing.exists };
}

export async function listUnitNumbersForProperty(
  landlordId: string,
  propertyId: string
) {
  const snap = await db
    .collection(COL)
    .where("landlordId", "==", landlordId)
    .where("propertyId", "==", propertyId)
    .select("unitNumber")
    .get();

  return snap.docs
    .map((d) => (d.data() as any)?.unitNumber)
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}
