import crypto from "crypto";
import { db } from "../config/firebase";
const COLLECTION = "properties";

type PropertyRecord = {
  id: string;
  landlordId: string;
  addressLine1: string;
  managerEmail?: string;
  totalUnits?: number;
  createdAt: string;
};

export async function createDevProperty(input: {
  landlordId: string;
  addressLine1: string;
  managerEmail?: string;
  totalUnits?: number;
}): Promise<PropertyRecord> {
  const ref = db.collection(COLLECTION).doc(crypto.randomUUID());
  const createdAt = new Date().toISOString();

  const data: PropertyRecord = {
    id: ref.id,
    landlordId: input.landlordId,
    addressLine1: input.addressLine1,
    createdAt,
  };

  if (input.managerEmail) data.managerEmail = input.managerEmail;
  if (typeof input.totalUnits === "number") data.totalUnits = input.totalUnits;

  await ref.set(data);
  return data;
}

export async function getPropertyById(
  id: string
): Promise<PropertyRecord | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as PropertyRecord;
  return data ?? null;
}

export async function listProperties(): Promise<PropertyRecord[]> {
  const snap = await db.collection(COLLECTION).get();
  return snap.docs
    .map((doc) => doc.data() as PropertyRecord)
    .filter((p) => p && p.id);
}
