import { describe, expect, it } from "vitest";
import {
  csvUsesOccupancyMetadataHeaders,
  normalizeCsvPreviewText,
  parseCsvPreview,
  parseUnitsCsvForManualImport,
} from "./csvPreview";

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

  it("parses official unit CSV template occupancy metadata headers for manual import", () => {
    const csv =
      "unitNumber,marketRent,beds,baths,sqft,status,occupantName,leaseEndDate\n" +
      "301,2100,2,1.5,850,occupied,Jane Tenant,2027-06-10\n" +
      "302,1900,1,1,650,vacant,,";

    const result = parseUnitsCsvForManualImport(csv);

    expect(csvUsesOccupancyMetadataHeaders(result.headers)).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.units).toEqual([
      expect.objectContaining({
        unitNumber: "301",
        marketRent: 2100,
        beds: 2,
        baths: 1.5,
        sqft: 850,
        status: "occupied",
        occupantName: "Jane Tenant",
        tenantName: "Jane Tenant",
        leaseEndDate: "2027-06-10",
      }),
      expect.objectContaining({
        unitNumber: "302",
        status: "vacant",
        occupantName: null,
        leaseEndDate: null,
      }),
    ]);
    expect(result.previewRows[0].data.occupantName).toBe("Jane Tenant");
  });

  it("leaves legacy CSVs without occupancy metadata eligible for backend preview", () => {
    const result = parseUnitsCsvForManualImport("unitNumber,marketRent,beds,baths,sqft,status\n101,1800,2,1,700,vacant");

    expect(csvUsesOccupancyMetadataHeaders(result.headers)).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.units[0]).toEqual(expect.objectContaining({ unitNumber: "101", status: "vacant" }));
  });
});
