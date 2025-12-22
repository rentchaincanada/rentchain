import admin from "firebase-admin";

export async function getSignedDownloadUrl(opts: {
  bucket: string;
  path: string;
  expiresMinutes?: number;
}) {
  const expiresMinutes = opts.expiresMinutes ?? 15;
  const bucket = admin.storage().bucket(opts.bucket);
  const file = bucket.file(opts.path);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });

  return url;
}
