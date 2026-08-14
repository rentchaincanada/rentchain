import crypto from "crypto";
import path from "path";
import sharp, { type Metadata } from "sharp";

export const MAINTENANCE_IMAGE_ATTACHMENT_COLLECTION = "maintenanceRequestAttachments";
export const MAX_MAINTENANCE_IMAGE_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_MAINTENANCE_IMAGE_ATTACHMENTS = 5;
export const MAX_MAINTENANCE_IMAGE_TOTAL_BYTES = 25 * 1024 * 1024;
export const MAX_MAINTENANCE_IMAGE_WIDTH = 10_000;
export const MAX_MAINTENANCE_IMAGE_HEIGHT = 10_000;
export const MAX_MAINTENANCE_IMAGE_PIXELS = 40_000_000;

export const MAINTENANCE_IMAGE_FORMATS = ["jpeg", "png", "webp"] as const;
export type MaintenanceImageFormat = (typeof MAINTENANCE_IMAGE_FORMATS)[number];

export type MaintenanceImageAttachmentRecord = {
  attachmentId: string;
  maintenanceRequestId: string;
  tenantId: string;
  landlordId: string;
  propertyId: string;
  leaseId: string | null;
  uploadedByUserId: string;
  uploadedByRole: "tenant";
  storageObjectKey: string;
  originalFilename: string;
  normalizedContentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
  status: "ready";
  createdAt: number;
};

export type MaintenanceImageAttachmentProjection = {
  attachmentId: string;
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  createdAt: number;
};

export class MaintenanceImageError extends Error {
  constructor(
    public readonly code:
      | "FILE_REQUIRED"
      | "FILE_TOO_LARGE"
      | "UNSUPPORTED_FILE_TYPE"
      | "IMAGE_DECODE_FAILED"
      | "IMAGE_DIMENSIONS_EXCEEDED",
    message = code
  ) {
    super(message);
  }
}

function normalizedFormat(value: unknown): MaintenanceImageFormat | null {
  const format = String(value || "").toLowerCase();
  return (MAINTENANCE_IMAGE_FORMATS as readonly string[]).includes(format)
    ? (format as MaintenanceImageFormat)
    : null;
}

export function safeImageDisplayFilename(value: unknown, format: MaintenanceImageFormat) {
  const raw = path.basename(String(value || "photo")).slice(0, 160);
  const stem = raw.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9 _.-]+/g, "-").trim() || "photo";
  const extension = format === "jpeg" ? "jpg" : format;
  return `${stem.slice(0, 140)}.${extension}`;
}

export function buildMaintenanceImageObjectKey(requestId: string, attachmentId: string, format: MaintenanceImageFormat) {
  const extension = format === "jpeg" ? "jpg" : format;
  return `maintenance/images/${requestId}/${attachmentId}.${extension}`;
}

export function projectMaintenanceImageAttachment(
  record: MaintenanceImageAttachmentRecord
): MaintenanceImageAttachmentProjection {
  return {
    attachmentId: record.attachmentId,
    filename: record.originalFilename,
    contentType: record.normalizedContentType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    createdAt: record.createdAt,
  };
}

export function parseMaintenanceImageAttachment(value: unknown): MaintenanceImageAttachmentRecord | null {
  const record = (value && typeof value === "object" ? value : {}) as Partial<MaintenanceImageAttachmentRecord>;
  if (
    !record.attachmentId ||
    !record.maintenanceRequestId ||
    !record.tenantId ||
    !record.landlordId ||
    !record.propertyId ||
    !record.storageObjectKey ||
    !record.originalFilename ||
    !record.normalizedContentType ||
    !record.byteSize ||
    !record.width ||
    !record.height ||
    !record.createdAt ||
    record.status !== "ready" ||
    record.uploadedByRole !== "tenant"
  ) {
    return null;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(record.normalizedContentType)) return null;
  return record as MaintenanceImageAttachmentRecord;
}

export async function processMaintenanceImage(input: { buffer: Buffer; originalFilename: string }) {
  if (!input.buffer?.length) throw new MaintenanceImageError("FILE_REQUIRED");
  if (input.buffer.length > MAX_MAINTENANCE_IMAGE_INPUT_BYTES) {
    throw new MaintenanceImageError("FILE_TOO_LARGE");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.buffer, {
      failOn: "error",
      limitInputPixels: MAX_MAINTENANCE_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new MaintenanceImageError("IMAGE_DECODE_FAILED");
  }

  const format = normalizedFormat(metadata.format);
  if (!format) throw new MaintenanceImageError("UNSUPPORTED_FILE_TYPE");
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (
    !width ||
    !height ||
    width > MAX_MAINTENANCE_IMAGE_WIDTH ||
    height > MAX_MAINTENANCE_IMAGE_HEIGHT ||
    width * height > MAX_MAINTENANCE_IMAGE_PIXELS
  ) {
    throw new MaintenanceImageError("IMAGE_DIMENSIONS_EXCEEDED");
  }

  let pipeline = sharp(input.buffer, {
    failOn: "error",
    limitInputPixels: MAX_MAINTENANCE_IMAGE_PIXELS,
    sequentialRead: true,
  }).rotate();
  if (format === "jpeg") pipeline = pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true });
  if (format === "png") pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  if (format === "webp") pipeline = pipeline.webp({ quality: 82 });

  let buffer: Buffer;
  try {
    buffer = await pipeline.toBuffer();
  } catch {
    throw new MaintenanceImageError("IMAGE_DECODE_FAILED");
  }

  const canonical = await sharp(buffer, { failOn: "error", limitInputPixels: MAX_MAINTENANCE_IMAGE_PIXELS }).metadata();
  const canonicalFormat = normalizedFormat(canonical.format);
  if (!canonicalFormat || canonicalFormat !== format || !canonical.width || !canonical.height) {
    throw new MaintenanceImageError("IMAGE_DECODE_FAILED");
  }

  return {
    buffer,
    format,
    contentType: (format === "jpeg" ? "image/jpeg" : `image/${format}`) as
      | "image/jpeg"
      | "image/png"
      | "image/webp",
    width: canonical.width,
    height: canonical.height,
    filename: safeImageDisplayFilename(input.originalFilename, format),
    checksumSha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    metadataStripped:
      !canonical.exif && !canonical.icc && !canonical.iptc && !canonical.xmp && !canonical.tifftagPhotoshop,
  };
}

export function makeMaintenanceImageAttachmentId() {
  return crypto.randomUUID();
}
