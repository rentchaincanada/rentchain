import { describe, expect, it } from "vitest";

import { sidesForDocumentType, tenantIdentityStatusLabel, validateIdentityImage } from "./tenantIdentityWorkflow";

describe("tenant identity workflow", () => {
  it("uses document-appropriate image sides", () => {
    expect(sidesForDocumentType("passport")).toEqual([{ value: "photo_page", label: "Photo page" }]);
    expect(sidesForDocumentType("drivers_license").map((side) => side.value)).toEqual(["front", "back"]);
  });

  it("rejects PDF and oversized uploads before network access", () => {
    expect(validateIdentityImage(new File(["pdf"], "id.pdf", { type: "application/pdf" }))).toMatch(/Unsupported/);
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "id.png", { type: "image/png" });
    expect(validateIdentityImage(oversized)).toMatch(/too large/i);
  });

  it("describes custody without claiming verification", () => {
    expect(tenantIdentityStatusLabel([{ status: "ready" } as any])).toBe("Government ID received");
  });
});
