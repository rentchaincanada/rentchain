import { db } from "../../firebase";
import type {
  ScreeningOperation,
  ScreeningOperationCreateInput,
  ScreeningOperationListFilters,
  ScreeningOperationStatus,
} from "./screeningOpsTypes";

const COLLECTION = "screeningOperations";

function isoNow() {
  return new Date().toISOString();
}

function sanitizeString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function mapOperation(id: string, data: any): ScreeningOperation {
  return {
    id,
    applicationId: String(data?.applicationId || ""),
    landlordId: String(data?.landlordId || ""),
    propertyId: sanitizeString(data?.propertyId),
    unitId: sanitizeString(data?.unitId),
    applicantName: sanitizeString(data?.applicantName),
    provider: "transunion_manual",
    status: String(data?.status || "requested") as ScreeningOperationStatus,
    requestedAt: String(data?.requestedAt || ""),
    startedAt: sanitizeString(data?.startedAt),
    completedAt: sanitizeString(data?.completedAt),
    cancelledAt: sanitizeString(data?.cancelledAt),
    cancelledReason: sanitizeString(data?.cancelledReason),
    resultSummary: sanitizeString(data?.resultSummary),
    resultFlags: normalizeFlags(data?.resultFlags),
    reportUrl: sanitizeString(data?.reportUrl),
    reportExportId: sanitizeString(data?.reportExportId),
    operatorNotes: sanitizeString(data?.operatorNotes),
    createdAt: String(data?.createdAt || ""),
    updatedAt: String(data?.updatedAt || ""),
    updatedByUserId: sanitizeString(data?.updatedByUserId),
  };
}

function sortNewestFirst(items: ScreeningOperation[]) {
  return items.slice().sort((left, right) => {
    const leftTs = Date.parse(left.updatedAt || left.createdAt || "") || 0;
    const rightTs = Date.parse(right.updatedAt || right.createdAt || "") || 0;
    return rightTs - leftTs;
  });
}

function buildId() {
  return `screening-op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getScreeningOperationById(id: string): Promise<ScreeningOperation | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return mapOperation(snap.id, snap.data());
}

export async function listScreeningOperations(
  filters: ScreeningOperationListFilters = {}
): Promise<ScreeningOperation[]> {
  let query: any = db.collection(COLLECTION);
  if (filters.landlordId) {
    query = query.where("landlordId", "==", filters.landlordId);
  }
  if (filters.applicationId) {
    query = query.where("applicationId", "==", filters.applicationId);
  }
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }
  const snap = await query.limit(50).get();
  return sortNewestFirst(snap.docs.map((doc: any) => mapOperation(doc.id, doc.data())));
}

export async function getLatestScreeningOperationForApplication(
  applicationId: string
): Promise<ScreeningOperation | null> {
  const items = await listScreeningOperations({ applicationId });
  return items[0] || null;
}

export async function createScreeningOperation(
  input: ScreeningOperationCreateInput
): Promise<ScreeningOperation> {
  const id = buildId();
  const now = isoNow();
  const payload: ScreeningOperation = {
    id,
    applicationId: input.applicationId,
    landlordId: input.landlordId,
    propertyId: sanitizeString(input.propertyId),
    unitId: sanitizeString(input.unitId),
    applicantName: sanitizeString(input.applicantName),
    provider: "transunion_manual",
    status: "requested",
    requestedAt: now,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    resultSummary: null,
    resultFlags: [],
    reportUrl: null,
    reportExportId: null,
    operatorNotes: null,
    createdAt: now,
    updatedAt: now,
    updatedByUserId: sanitizeString(input.updatedByUserId),
  };
  await db.collection(COLLECTION).doc(id).set(payload, { merge: false });
  return payload;
}

export async function updateScreeningOperation(
  id: string,
  patch: Partial<ScreeningOperation>
): Promise<ScreeningOperation> {
  const now = isoNow();
  await db.collection(COLLECTION).doc(id).set(
    {
      ...patch,
      updatedAt: now,
    },
    { merge: true }
  );
  const updated = await getScreeningOperationById(id);
  if (!updated) {
    throw new Error("screening_not_found");
  }
  return updated;
}
