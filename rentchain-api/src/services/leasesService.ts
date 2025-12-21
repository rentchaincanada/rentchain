// BACKEND: rentchain-api/src/services/leasesService.ts

import { v4 as uuidv4 } from "uuid";
import { db } from "../firebase";
import { LeaseInput, LeaseRecord, LeaseStatus } from "../models/lease";

const COLLECTION = "leases";

export async function createLease(input: LeaseInput): Promise<LeaseRecord> {
  const now = new Date().toISOString();
  const id = uuidv4();

  const status: LeaseStatus = input.status ?? "active";

  const record: LeaseRecord = {
    ...input,
    id,
    status,
    createdAt: now,
    updatedAt: now,
    endDate: input.endDate ?? null,
  };

  await db.collection(COLLECTION).doc(id).set(record);
  return record;
}

export async function getLeasesForTenant(
  tenantId: string
): Promise<LeaseRecord[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();

    const records = snapshot.docs.map((doc) => doc.data() as LeaseRecord);

    // Sort newest start date first
    records.sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    return records;
  } catch (err) {
    console.error(
      `[leasesService] Failed to get leases for tenant ${tenantId}`,
      err
    );
    throw err;
  }
}
