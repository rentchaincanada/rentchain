import admin from "firebase-admin";

import type {
  AuthorizedIdentityDocumentAccess,
  IdentityDocumentStorage,
  IdentityDocumentStorageObject,
  IdentityDocumentStorageWrite,
} from "./identityDocumentStorage";

export const IDENTITY_DOCUMENT_BUCKET_ENV = "GCS_IDENTITY_DOCUMENT_BUCKET";
export const MAX_IDENTITY_DOCUMENT_ACCESS_MINUTES = 5;

function identityDocumentBucket() {
  const bucketName = String(process.env[IDENTITY_DOCUMENT_BUCKET_ENV] || "").trim();
  if (!bucketName) throw new Error(`${IDENTITY_DOCUMENT_BUCKET_ENV} is not set`);
  return admin.storage().bucket(bucketName);
}

export class GcsIdentityDocumentStorage implements IdentityDocumentStorage {
  private async put(input: IdentityDocumentStorageWrite): Promise<IdentityDocumentStorageObject> {
    const bucket = identityDocumentBucket();
    const file = bucket.file(input.opaqueObjectId);
    await file.save(Buffer.from(input.bytes), {
      resumable: false,
      contentType: input.mimeType,
      metadata: {
        cacheControl: "private, no-store, max-age=0",
        metadata: {
          checksumSha256: input.checksumSha256,
          custody: "tenant-identity-document",
        },
      },
    });
    return {
      objectId: input.opaqueObjectId,
      checksumSha256: input.checksumSha256,
      byteSize: input.bytes.byteLength,
      mimeType: input.mimeType,
    };
  }

  putOriginal(input: IdentityDocumentStorageWrite) {
    return this.put(input);
  }

  putSanitizedDerivative(input: IdentityDocumentStorageWrite) {
    return this.put(input);
  }

  async getAuthorizedAccess(input: {
    opaqueObjectId: string;
    actorId: string;
    purposeCode: string;
  }): Promise<AuthorizedIdentityDocumentAccess> {
    if (!input.actorId.trim() || !input.purposeCode.trim()) throw new Error("AUTHORIZED_ACCESS_CONTEXT_REQUIRED");
    const expiresAtMs = Date.now() + MAX_IDENTITY_DOCUMENT_ACCESS_MINUTES * 60 * 1000;
    const [accessReference] = await identityDocumentBucket().file(input.opaqueObjectId).getSignedUrl({
      action: "read",
      expires: expiresAtMs,
      responseDisposition: "inline",
    });
    return {
      accessReference,
      expiresAt: new Date(expiresAtMs).toISOString(),
      cachePolicy: "private_no_store",
    };
  }

  async delete(input: { opaqueObjectId: string; reasonCode: string }) {
    if (!input.reasonCode.trim()) throw new Error("DELETE_REASON_REQUIRED");
    await identityDocumentBucket().file(input.opaqueObjectId).delete({ ignoreNotFound: true });
  }

  async exists(input: { opaqueObjectId: string }) {
    const [exists] = await identityDocumentBucket().file(input.opaqueObjectId).exists();
    return exists;
  }
}
