import crypto from "crypto";
import { db } from "../../config/firebase";
import { FRONTEND_URL } from "../../config/screeningConfig";
import { uploadBufferToGcs } from "../../lib/gcs";
import { getFileReadStream } from "../../lib/gcsRead";

const DEFAULT_EXPIRES_DAYS = 7;

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildShareUrl(exportId: string, token: string) {
  const base = FRONTEND_URL.replace(/\/$/, "");
  return `${base}/screening/report?exportId=${encodeURIComponent(exportId)}&token=${encodeURIComponent(token)}`;
}

export async function createReportExport(opts: {
  applicationId: string;
  landlordId: string | null;
  resultId: string;
  pdfBuffer: Buffer;
  expiresAt?: number | null;
}) {
  const exportRef = db.collection("screeningReportExports").doc();
  const exportId = exportRef.id;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const createdAt = Date.now();
  const expiresAt =
    typeof opts.expiresAt === "number"
      ? opts.expiresAt
      : createdAt + DEFAULT_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

  let storagePath: string | null = null;
  let storageBucket: string | null = null;
  let pdfBase64: string | null = null;

  try {
    const uploaded = await uploadBufferToGcs({
      path: `screening-exports/${exportId}.pdf`,
      contentType: "application/pdf",
      buffer: opts.pdfBuffer,
    });
    storagePath = uploaded.path;
    storageBucket = uploaded.bucket;
  } catch {
    pdfBase64 = opts.pdfBuffer.toString("base64");
  }

  await exportRef.set({
    applicationId: opts.applicationId,
    landlordId: opts.landlordId || "",
    resultId: opts.resultId,
    createdAt,
    expiresAt,
    tokenHash,
    storagePath,
    storageBucket,
    pdfBase64,
    status: "ready",
  });

  return { exportId, token, expiresAt, storagePath, storageBucket };
}

export async function getReportExport(exportId: string) {
  const snap = await db.collection("screeningReportExports").doc(exportId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

export function validateToken(exportDoc: any, token: string) {
  if (!exportDoc?.tokenHash) return false;
  return hashToken(token) === exportDoc.tokenHash;
}

export async function getExportPdfBuffer(exportDoc: any) {
  if (exportDoc?.pdfBase64) {
    return Buffer.from(exportDoc.pdfBase64, "base64");
  }
  if (exportDoc?.storagePath && exportDoc?.storageBucket) {
    const stream = getFileReadStream({ bucket: exportDoc.storageBucket, path: exportDoc.storagePath });
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }
  return null;
}
