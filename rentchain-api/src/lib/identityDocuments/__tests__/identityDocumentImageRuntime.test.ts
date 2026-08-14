import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildIdentityDocumentObjectKey,
  IdentityDocumentImageError,
  makeOpaqueIdentityDocumentIds,
  processIdentityDocumentImage,
} from "../identityDocumentImageRuntime";

describe("G1B identity document image runtime", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("decodes %s and creates a metadata-free derivative", async (format, mimeType) => {
    let source = sharp({ create: { width: 120, height: 80, channels: 3, background: "navy" } }).withMetadata({
      exif: { IFD0: { Copyright: "synthetic-only" } },
    });
    if (format === "jpeg") source = source.jpeg();
    if (format === "png") source = source.png();
    if (format === "webp") source = source.webp();
    const bytes = await source.toBuffer();

    const result = await processIdentityDocumentImage({ bytes, declaredMimeType: mimeType });

    expect(result.original.bytes.equals(bytes)).toBe(true);
    expect(result.original.mimeType).toBe(mimeType);
    expect(result.original.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sanitized.mimeType).toBe(mimeType);
    expect(result.sanitized.metadataStripped).toBe(true);
    const metadata = await sharp(result.sanitized.bytes).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(80);
  });

  it("rejects malformed, spoofed, unsupported, and empty input", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
    await expect(processIdentityDocumentImage({ bytes: png, declaredMimeType: "image/jpeg" })).rejects.toMatchObject({ code: "MIME_MISMATCH" });
    await expect(processIdentityDocumentImage({ bytes: Buffer.from("not-an-image") })).rejects.toMatchObject({ code: "IMAGE_DECODE_FAILED" });
    await expect(processIdentityDocumentImage({ bytes: Buffer.alloc(0) })).rejects.toEqual(new IdentityDocumentImageError("FILE_REQUIRED"));
    await expect(processIdentityDocumentImage({ bytes: Buffer.from("%PDF-1.7") })).rejects.toMatchObject({ code: "IMAGE_DECODE_FAILED" });
    await expect(processIdentityDocumentImage({ bytes: Buffer.from("<svg></svg>") })).rejects.toMatchObject({ code: "IMAGE_DECODE_FAILED" });
  });

  it("uses opaque, PII-free object paths", () => {
    const ids = makeOpaqueIdentityDocumentIds();
    const key = buildIdentityDocumentObjectKey({
      documentId: ids.documentId,
      objectId: ids.originalObjectId,
      representation: "original",
    });
    expect(key).toBe(`identity/${ids.documentId}/original/${ids.originalObjectId}`);
    expect(key).not.toMatch(/tenant|email|passport|licen[cs]e/i);
    expect(() => buildIdentityDocumentObjectKey({ documentId: "tenant@example.com", objectId: ids.originalObjectId, representation: "original" })).toThrow("OPAQUE_ID_REQUIRED");
  });
});
