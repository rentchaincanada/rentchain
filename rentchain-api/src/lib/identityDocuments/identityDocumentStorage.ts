import type { IdentityDocumentMimeType } from "./identityDocumentTypes";

export type IdentityDocumentStorageObject = {
  objectId: string;
  checksumSha256: string;
  byteSize: number;
  mimeType: IdentityDocumentMimeType;
};

export type IdentityDocumentStorageWrite = {
  opaqueObjectId: string;
  bytes: Uint8Array;
  mimeType: IdentityDocumentMimeType;
  checksumSha256: string;
};

export type AuthorizedIdentityDocumentAccess = {
  accessReference: string;
  expiresAt: string;
  cachePolicy: "private_no_store";
};

/** Contract only. G1A intentionally provides no GCS implementation or signed-URL generator. */
export interface IdentityDocumentStorage {
  putOriginal(input: IdentityDocumentStorageWrite): Promise<IdentityDocumentStorageObject>;
  putSanitizedDerivative(input: IdentityDocumentStorageWrite): Promise<IdentityDocumentStorageObject>;
  getAuthorizedAccess(input: {
    opaqueObjectId: string;
    actorId: string;
    purposeCode: string;
  }): Promise<AuthorizedIdentityDocumentAccess>;
  delete(input: { opaqueObjectId: string; reasonCode: string }): Promise<void>;
  exists(input: { opaqueObjectId: string }): Promise<boolean>;
}
