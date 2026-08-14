import crypto from "crypto";
import sharp, { type Metadata } from "sharp";

import {
  IDENTITY_DOCUMENT_MIME_TYPES,
  MAX_IDENTITY_DOCUMENT_FILE_BYTES,
  MAX_IDENTITY_DOCUMENT_HEIGHT,
  MAX_IDENTITY_DOCUMENT_PIXELS,
  MAX_IDENTITY_DOCUMENT_WIDTH,
  type IdentityDocumentMimeType,
} from "./identityDocumentTypes";

export type IdentityDocumentImageFormat = "jpeg" | "png" | "webp";

export class IdentityDocumentImageError extends Error {
  constructor(
    public readonly code:
      | "FILE_REQUIRED"
      | "FILE_TOO_LARGE"
      | "UNSUPPORTED_FILE_TYPE"
      | "MIME_MISMATCH"
      | "IMAGE_DECODE_FAILED"
      | "IMAGE_DIMENSIONS_EXCEEDED"
      | "ANIMATED_OR_MULTIPAGE_IMAGE_NOT_ALLOWED"
      | "IMAGE_METADATA_STRIP_FAILED",
  ) {
    super(code);
  }
}

function formatToMime(format: string | undefined): IdentityDocumentMimeType | null {
  const mime = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : format === "webp" ? "image/webp" : null;
  return mime && (IDENTITY_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime) ? mime : null;
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertDecodedMetadata(metadata: Metadata) {
  const mimeType = formatToMime(metadata.format);
  if (!mimeType) throw new IdentityDocumentImageError("UNSUPPORTED_FILE_TYPE");
  if (Number(metadata.pages || 1) !== 1) {
    throw new IdentityDocumentImageError("ANIMATED_OR_MULTIPAGE_IMAGE_NOT_ALLOWED");
  }
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (
    !width ||
    !height ||
    width > MAX_IDENTITY_DOCUMENT_WIDTH ||
    height > MAX_IDENTITY_DOCUMENT_HEIGHT ||
    width * height > MAX_IDENTITY_DOCUMENT_PIXELS
  ) {
    throw new IdentityDocumentImageError("IMAGE_DIMENSIONS_EXCEEDED");
  }
  return { mimeType, width, height, format: metadata.format as IdentityDocumentImageFormat };
}

export async function processIdentityDocumentImage(input: {
  bytes: Buffer;
  declaredMimeType?: string | null;
}) {
  if (!input.bytes?.length) throw new IdentityDocumentImageError("FILE_REQUIRED");
  if (input.bytes.length > MAX_IDENTITY_DOCUMENT_FILE_BYTES) {
    throw new IdentityDocumentImageError("FILE_TOO_LARGE");
  }

  let decoded: Metadata;
  try {
    decoded = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: MAX_IDENTITY_DOCUMENT_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new IdentityDocumentImageError("IMAGE_DECODE_FAILED");
  }

  const source = assertDecodedMetadata(decoded);
  const declared = String(input.declaredMimeType || "").trim().toLowerCase();
  if (declared && declared !== source.mimeType) throw new IdentityDocumentImageError("MIME_MISMATCH");

  let derivativePipeline = sharp(input.bytes, {
    failOn: "error",
    limitInputPixels: MAX_IDENTITY_DOCUMENT_PIXELS,
    sequentialRead: true,
  }).rotate();
  if (source.format === "jpeg") derivativePipeline = derivativePipeline.jpeg({ quality: 92, progressive: true, mozjpeg: true });
  if (source.format === "png") derivativePipeline = derivativePipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  if (source.format === "webp") derivativePipeline = derivativePipeline.webp({ quality: 92 });

  let sanitizedBytes: Buffer;
  try {
    sanitizedBytes = await derivativePipeline.toBuffer();
  } catch {
    throw new IdentityDocumentImageError("IMAGE_DECODE_FAILED");
  }

  const sanitizedMetadata = await sharp(sanitizedBytes, {
    failOn: "error",
    limitInputPixels: MAX_IDENTITY_DOCUMENT_PIXELS,
  }).metadata();
  const sanitized = assertDecodedMetadata(sanitizedMetadata);
  if (
    sanitized.mimeType !== source.mimeType ||
    sanitizedMetadata.exif ||
    sanitizedMetadata.iptc ||
    sanitizedMetadata.xmp ||
    sanitizedMetadata.tifftagPhotoshop
  ) {
    throw new IdentityDocumentImageError("IMAGE_METADATA_STRIP_FAILED");
  }

  return {
    original: {
      bytes: Buffer.from(input.bytes),
      mimeType: source.mimeType,
      byteSize: input.bytes.length,
      checksumSha256: sha256(input.bytes),
    },
    sanitized: {
      bytes: sanitizedBytes,
      mimeType: sanitized.mimeType,
      byteSize: sanitizedBytes.length,
      checksumSha256: sha256(sanitizedBytes),
      width: sanitized.width,
      height: sanitized.height,
      metadataStripped: true as const,
    },
  };
}

export function makeOpaqueIdentityDocumentIds() {
  const documentId = crypto.randomUUID();
  return {
    documentId,
    originalObjectId: crypto.randomUUID(),
    sanitizedObjectId: crypto.randomUUID(),
  };
}

export function buildIdentityDocumentObjectKey(input: {
  documentId: string;
  objectId: string;
  representation: "original" | "sanitized";
}) {
  const opaqueId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!opaqueId.test(input.documentId) || !opaqueId.test(input.objectId)) {
    throw new Error("OPAQUE_ID_REQUIRED");
  }
  return `identity/${input.documentId}/${input.representation}/${input.objectId}`;
}
