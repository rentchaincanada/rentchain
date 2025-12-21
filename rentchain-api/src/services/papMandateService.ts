// src/services/papMandateService.ts
import { firestore } from "../events/firestore";

export type PapMandateStatus = "pending" | "active" | "revoked" | "expired";

export interface PapMandate {
  id: string;
  tenantId: string;
  leaseId?: string | null;

  // Bank info (never store raw account in plain text in production)
  bankName?: string | null;
  institutionNumber?: string | null;
  transitNumber?: string | null;
  accountMasked?: string | null; // e.g. ****1234
  accountNumberHash?: string | null;

  // Limits & schedule
  maxDebitAmount?: number | null;
  frequency?: "monthly" | "weekly" | "biweekly" | "other";
  dayOfMonth?: number | null;

  status: PapMandateStatus;

  signedAt?: string | null;
  signedBy?: string | null;

  mandateDocumentId?: string | null;        // PDF or doc ID for the mandate
  linkedLeaseDocumentId?: string | null;    // lease PDF that contains PAP clause

  createdAt: string;
  updatedAt: string;
}

const COLLECTION_NAME = "papMandates";

export async function createPapMandate(
  input: Omit<PapMandate, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: PapMandateStatus;
  }
): Promise<PapMandate> {
  const nowIso = new Date().toISOString();
  const docRef = firestore.collection(COLLECTION_NAME).doc();

  const mandate: PapMandate = {
    id: docRef.id,
    tenantId: input.tenantId,
    leaseId: input.leaseId ?? null,

    bankName: input.bankName ?? null,
    institutionNumber: input.institutionNumber ?? null,
    transitNumber: input.transitNumber ?? null,
    accountMasked: input.accountMasked ?? null,
    accountNumberHash: input.accountNumberHash ?? null,

    maxDebitAmount:
      typeof input.maxDebitAmount === "number"
        ? input.maxDebitAmount
        : input.maxDebitAmount != null
        ? Number(input.maxDebitAmount)
        : null,

    frequency: input.frequency ?? "monthly",
    dayOfMonth:
      typeof input.dayOfMonth === "number"
        ? input.dayOfMonth
        : input.dayOfMonth != null
        ? Number(input.dayOfMonth)
        : null,

    status: input.status ?? "active",

    signedAt: input.signedAt ?? null,
    signedBy: input.signedBy ?? null,

    mandateDocumentId: input.mandateDocumentId ?? null,
    linkedLeaseDocumentId: input.linkedLeaseDocumentId ?? null,

    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(mandate);
  return mandate;
}

export async function getPapMandateById(
  id: string
): Promise<PapMandate | null> {
  const snap = await firestore.collection(COLLECTION_NAME).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as PapMandate;
}

export async function getPapMandatesForTenant(
  tenantId: string
): Promise<PapMandate[]> {
  const snap = await firestore
    .collection(COLLECTION_NAME)
    .where("tenantId", "==", tenantId)
    .get();

  return snap.docs.map((d) => d.data() as PapMandate);
}

export async function updatePapMandateStatus(
  id: string,
  status: PapMandateStatus
): Promise<PapMandate | null> {
  const ref = firestore.collection(COLLECTION_NAME).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const nowIso = new Date().toISOString();

  await ref.update({
    status,
    updatedAt: nowIso,
  });

  const updatedSnap = await ref.get();
  return updatedSnap.data() as PapMandate;
}
