import { describe, expect, it } from "vitest";
import { normalizeCsvPreviewText, parseCsvPreview } from "./csvPreview";

describe("csvPreview", () => {
  it("normalizes Numbers-style BOM, null bytes, CR rows, and no-break spaces", () => {
    const text = "\uFFFD\uFFFDU\u0000n\u0000i\u0000t\u0000,\u0000R\u0000e\u0000n\u0000t\u0000\r101,1\u00A0850\r";

    expect(normalizeCsvPreviewText(text)).toBe("Unit,Rent\n101,1 850\n");
  });

  it("parses normalized Numbers-style preview rows", () => {
    const result = parseCsvPreview("\uFEFFunitNumber,marketRent\r101,\"1,850\"\r102,1\u00A0650\r");

    expect(result.headers).toEqual(["unitNumber", "marketRent"]);
    expect(result.rows).toEqual([
      ["101", "1,850"],
      ["102", "1 650"],
    ]);
  });
});
