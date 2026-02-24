// BACKEND: rentchain-api/src/services/leasesService.ts

import { v4 as uuidv4 } from "uuid";
import { db } from "../firebase";
import {
  LeaseInput,
  LeaseRecord,
  LeaseRenewalStatus,
  LeaseStatus,
} from "../models/lease";

const COLLECTION = "leases";

export async function createLease(input: LeaseInput): Promise<LeaseRecord> {
  const now = new Date().toISOString();
  const id = uuidv4();

  const status: LeaseStatus = input.status ?? "active";
  const renewalStatus: LeaseRenewalStatus = input.renewalStatus ?? "unknown";
  const automationEnabled = input.automationEnabled ?? true;

  const record: LeaseRecord = {
    ...input,
    id,
    status,
    renewalStatus,
    automationEnabled,
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

type LeaseLifecycleUpdate = {
  startDate?: string;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: LeaseRenewalStatus;
};

export async function updateLeaseLifecycle(
  leaseId: string,
  updates: LeaseLifecycleUpdate
): Promise<LeaseRecord | null> {
  const id = String(leaseId || "").trim();
  if (!id) return null;

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const next: Partial<LeaseRecord> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.startDate !== undefined) next.startDate = updates.startDate;
  if (updates.endDate !== undefined) next.endDate = updates.endDate;
  if (updates.automationEnabled !== undefined) {
    next.automationEnabled = Boolean(updates.automationEnabled);
  }
  if (updates.renewalStatus !== undefined) next.renewalStatus = updates.renewalStatus;

  await ref.set(next, { merge: true });
  const refreshed = await ref.get();
  if (!refreshed.exists) return null;
  return refreshed.data() as LeaseRecord;
}
