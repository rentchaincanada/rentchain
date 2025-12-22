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

export function getFileReadStreamRange(opts: { bucket: string; path: string; start?: number; end?: number }) {
  const bucket = admin.storage().bucket(opts.bucket);
  const file = bucket.file(opts.path);
  return file.createReadStream({
    start: typeof opts.start === "number" ? opts.start : undefined,
    end: typeof opts.end === "number" ? opts.end : undefined,
  });
}
