import admin from "firebase-admin";

export function getFileReadStream(opts: { bucket: string; path: string }) {
  const bucket = admin.storage().bucket(opts.bucket);
  const file = bucket.file(opts.path);
  return file.createReadStream();
}

export async function getFileMetadata(opts: { bucket: string; path: string }) {
  const bucket = admin.storage().bucket(opts.bucket);
  const file = bucket.file(opts.path);
  const [meta] = await file.getMetadata();
  return meta;
}
