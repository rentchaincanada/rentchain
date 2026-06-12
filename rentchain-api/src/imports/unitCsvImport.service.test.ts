import { describe, expect, it } from "vitest";
import { parseUnitsCsv } from "./unitCsvImport.service";

describe("parseUnitsCsv", () => {
  it("parses BOM-prefixed CSVs with public template aliases", () => {
    const csv = "\uFEFFunitNumber,marketRent,beds,baths,sqft,status\r\n101,1850,1,1,610,vacant\r\n102,1650,0,1,450,occupied";

    const result = parseUnitsCsv(csv);

    expect(result.headers).toMatchObject({ valid: true, missing: [], unknown: [] });
    expect(result.preview.errors).toEqual([]);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].data).toMatchObject({
      unitNumber: "101",
      rent: 1850,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 610,
      status: "vacant",
    });
  });

  it("parses Numbers-style CSVs with CR line endings and formatted numeric cells", () => {
    const csv = [
      "\uFEFFunitNumber,marketRent,beds,baths,sqft,status",
      '101,"$1,850",1,1,610,vacant',
      "102,1\u00A0650,0,1,450,leased",
      ",,,,,",
    ].join("\r");

    const result = parseUnitsCsv(csv);

    expect(result.headers).toMatchObject({ valid: true, missing: [], unknown: [] });
    expect(result.preview.errors).toEqual([]);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].data).toMatchObject({
      unitNumber: "101",
      rent: 1850,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 610,
      status: "vacant",
    });
    expect(result.candidates[1].data).toMatchObject({
      unitNumber: "102",
      rent: 1650,
      bedrooms: 0,
      bathrooms: 1,
      sqft: 450,
      status: "occupied",
    });
  });

  it("recovers UTF-16 BOM text when upload decoding leaves null bytes", () => {
    const csv = Buffer.from("\uFEFFunitNumber,marketRent,beds\r101,1850,1", "utf16le").toString("utf8");

    const result = parseUnitsCsv(csv);

    expect(result.headers).toMatchObject({ valid: true, missing: [], unknown: [] });
    expect(result.preview.errors).toEqual([]);
    expect(result.candidates[0].data).toMatchObject({
      unitNumber: "101",
      rent: 1850,
      bedrooms: 1,
    });
  });

  it("reports exact missing and unknown headers", () => {
    const result = parseUnitsCsv("marketRent,internalId\n1850,secret");

    expect(result.headers.valid).toBe(false);
    expect(result.headers.missing).toEqual(["unitNumber"]);
    expect(result.headers.unknown).toEqual(["internalId"]);
    expect(result.preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "HEADER_MISSING", field: "unitNumber" }),
        expect.objectContaining({ code: "HEADER_UNKNOWN", field: "internalId" }),
      ])
    );
  });

  it("reports row-level field errors without silently coercing bad values", () => {
    const result = parseUnitsCsv("unitNumber,marketRent,beds,baths,sqft\n101,not-a-number,1,1,610\n102,1500,eleven,1,450");

    expect(result.preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 2, code: "ROW_INVALID", field: "rent" }),
        expect.objectContaining({ row: 3, code: "ROW_INVALID", field: "bedrooms" }),
      ])
    );
    expect(result.candidates).toHaveLength(0);
  });

  it("marks duplicate and empty rows in preview output", () => {
    const result = parseUnitsCsv("unitNumber,marketRent\n101,1850\n\n101,1900");

    expect(result.duplicatesInCsv).toEqual([
      expect.objectContaining({ row: 4, code: "DUPLICATE_IN_CSV", unitNumber: "101" }),
    ]);
    expect(result.preview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, status: "skipped" }),
        expect.objectContaining({ row: 4, status: "invalid" }),
      ])
    );
  });
});
