import { uploadBufferToGcs } from "../lib/gcs";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";

export async function putPdfObject(params: { objectKey: string; pdfBuffer: Buffer }) {
  const uploaded = await uploadBufferToGcs({
    path: params.objectKey,
    contentType: "application/pdf",
    buffer: params.pdfBuffer,
  });
  return uploaded;
}

export async function createSignedUrl(params: {
  bucket: string;
  objectKey: string;
  expiresSeconds: number;
}) {
  return getSignedDownloadUrl({
    bucket: params.bucket,
    path: params.objectKey,
    expiresSeconds: params.expiresSeconds,
    contentType: "application/pdf",
    filename: params.objectKey.split("/").pop() || "screening-report.pdf",
  });
}
