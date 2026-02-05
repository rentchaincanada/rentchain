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
  const expiresMinutes = Math.max(1, Math.ceil(params.expiresSeconds / 60));
  return getSignedDownloadUrl({
    bucket: params.bucket,
    path: params.objectKey,
    expiresMinutes,
  });
}
