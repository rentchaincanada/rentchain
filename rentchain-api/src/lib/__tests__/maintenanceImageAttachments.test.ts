import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  MAX_MAINTENANCE_IMAGE_INPUT_BYTES,
  MaintenanceImageError,
  buildMaintenanceImageObjectKey,
  processMaintenanceImage,
  projectMaintenanceImageAttachment,
  type MaintenanceImageAttachmentRecord,
} from "../maintenanceImageAttachments";

async function image(format: "jpeg" | "png" | "webp", width = 32, height = 24) {
  const source = sharp({ create: { width, height, channels: 3, background: { r: 25, g: 100, b: 180 } } });
  if (format === "jpeg") return source.jpeg().toBuffer();
  if (format === "png") return source.png().toBuffer();
  return source.webp().toBuffer();
}

describe("maintenance image attachment processing", () => {
  it.each(["jpeg", "png", "webp"] as const)("decodes and canonically re-encodes %s", async (format) => {
    const result = await processMaintenanceImage({ buffer: await image(format), originalFilename: `photo.${format}` });
    expect(result.format).toBe(format);
    expect(result.contentType).toBe(format === "jpeg" ? "image/jpeg" : `image/${format}`);
    expect(result.width).toBe(32);
    expect(result.height).toBe(24);
    expect(result.metadataStripped).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("strips EXIF metadata and applies orientation before canonical storage", async () => {
    const source = await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const result = await processMaintenanceImage({ buffer: source, originalFilename: "phone-photo.jpg" });
    const stored = await sharp(result.buffer).metadata();
    expect(result.metadataStripped).toBe(true);
    expect(stored.exif).toBeUndefined();
    expect(stored.orientation).toBeUndefined();
    expect([result.width, result.height]).toEqual([10, 20]);
  });

  it.each([
    ["renamed executable", Buffer.from("MZ fake executable")],
    ["invalid image bytes", Buffer.from("not an image")],
    ["PDF", Buffer.from("%PDF-1.7 fake")],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ])("rejects %s by decoding actual bytes", async (_label, buffer) => {
    await expect(processMaintenanceImage({ buffer, originalFilename: "spoofed.jpg" })).rejects.toBeInstanceOf(
      MaintenanceImageError
    );
  });

  it("rejects transport payloads over 10 MiB", async () => {
    await expect(
      processMaintenanceImage({ buffer: Buffer.alloc(MAX_MAINTENANCE_IMAGE_INPUT_BYTES + 1), originalFilename: "large.jpg" })
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rejects excessive dimensions even when compressed input is small", async () => {
    const oversized = await image("png", 10_001, 1);
    await expect(processMaintenanceImage({ buffer: oversized, originalFilename: "wide.png" })).rejects.toMatchObject({
      code: "IMAGE_DIMENSIONS_EXCEEDED",
    });
  });

  it("uses an opaque controlled namespace and a storage-safe projection", () => {
    expect(buildMaintenanceImageObjectKey("maint-1", "opaque-id", "jpeg")).toBe(
      "maintenance/images/maint-1/opaque-id.jpg"
    );
    const record: MaintenanceImageAttachmentRecord = {
      attachmentId: "opaque-id",
      maintenanceRequestId: "maint-1",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      leaseId: "lease-1",
      uploadedByUserId: "user-1",
      uploadedByRole: "tenant",
      storageObjectKey: "maintenance/images/maint-1/opaque-id.jpg",
      originalFilename: "kitchen.jpg",
      normalizedContentType: "image/jpeg",
      byteSize: 123,
      width: 32,
      height: 24,
      checksumSha256: "checksum",
      status: "ready",
      createdAt: 100,
    };
    const projection = projectMaintenanceImageAttachment(record);
    expect(projection).toEqual(expect.objectContaining({ attachmentId: "opaque-id", filename: "kitchen.jpg" }));
    expect(JSON.stringify(projection)).not.toContain("storage");
    expect(JSON.stringify(projection)).not.toContain("tenant-1");
    expect(JSON.stringify(projection)).not.toContain("landlord-1");
  });
});
