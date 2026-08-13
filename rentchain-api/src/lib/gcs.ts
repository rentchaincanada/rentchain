import admin from "firebase-admin";

export function getUploadsBucket() {
  const bucketName = process.env.GCS_UPLOAD_BUCKET;
  if (!bucketName) throw new Error("GCS_UPLOAD_BUCKET is not set");
  return admin.storage().bucket(bucketName);
}

export async function uploadBufferToGcs(opts: {
  path: string;
  contentType: string;
  buffer: Buffer;
  metadata?: Record<string, string>;
}) {
  const bucket = getUploadsBucket();
  const file = bucket.file(opts.path);

  await file.save(opts.buffer, {
    resumable: false,
    contentType: opts.contentType,
    metadata: {
      metadata: opts.metadata || {},
    },
  });

  return { bucket: bucket.name, path: opts.path };
}

export async function deleteObjectFromGcs(opts: { path: string; ignoreNotFound?: boolean }) {
  const bucket = getUploadsBucket();
  try {
    await bucket.file(opts.path).delete({ ignoreNotFound: opts.ignoreNotFound ?? true });
  } catch (error: any) {
    if ((opts.ignoreNotFound ?? true) && Number(error?.code) === 404) return;
    throw error;
  }
}
