import { describe, expect, it } from "vitest";
import { isMobilePdfPreviewUnsafe } from "./pdfPreviewGuard";

describe("pdfPreviewGuard", () => {
  it("blocks embedded PDF previews for mobile user agents", () => {
    expect(
      isMobilePdfPreviewUnsafe({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        width: 1024,
        coarsePointer: false,
      })
    ).toBe(true);
  });

  it("blocks embedded PDF previews for narrow coarse-pointer devices", () => {
    expect(
      isMobilePdfPreviewUnsafe({
        userAgent: "Mozilla/5.0",
        width: 390,
        coarsePointer: true,
      })
    ).toBe(true);
  });

  it("allows desktop iframe previews", () => {
    expect(
      isMobilePdfPreviewUnsafe({
        userAgent: "Mozilla/5.0",
        width: 1280,
        coarsePointer: false,
      })
    ).toBe(false);
  });
});
