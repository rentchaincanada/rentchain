import { db, FieldValue } from "../config/firebase";

export type ImportJobStatus = "started" | "completed" | "failed";

export type ImportJob = {
  landlordId: string;
  propertyId: string;
  idempotencyKey: string;
  status: ImportJobStatus;
  mode: "dryRun" | "strict" | "partial";
  totalRows: number;
  attemptedValid: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: any;
  updatedAt: any;
  csvObject?: { bucket?: string; path?: string; contentType?: string; originalName?: string; bytes?: number };
  reportObject?: { bucket?: string; path?: string; contentType?: string };
  reportGzipObject?: { bucket?: string; path?: string; contentType?: string };
  reportSha256?: string;
  csvSha256?: string;
};

export function importJobId(landlordId: string, propertyId: string, key: string) {
  return `${landlordId}__${propertyId}__${key}`.slice(0, 500);
}

export async function getImportJob(landlordId: string, propertyId: string, key: string) {
  const id = importJobId(landlordId, propertyId, key);
  const ref = db.collection("importJobs").doc(id);
  const snap = await ref.get();
  return { ref, snap };
}

export async function startImportJob(ref: any, data: Partial<ImportJob>) {
  await ref.set(
    {
      ...data,
      status: "started",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function finishImportJob(ref: any, data: Partial<ImportJob>) {
  await ref.set(
    {
      ...data,
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function failImportJob(ref: any, data: Partial<ImportJob>) {
  await ref.set(
    {
      ...data,
      status: "failed",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
