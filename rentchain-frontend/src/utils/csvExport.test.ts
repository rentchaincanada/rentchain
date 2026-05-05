import { describe, expect, it } from "vitest";
import { buildCsvBlob, buildCsvText, csvEscape } from "./csvExport";

describe("csvExport", () => {
  it("escapes CSV cells and generates text/csv content without HTML", async () => {
    expect(csvEscape('Apt "3", North')).toBe('"Apt ""3"", North"');

    const blob = buildCsvBlob(["Tenant", "Property", "Amount"], [["Taylor Tenant", "Harbour View", 1800]]);
    expect(blob.type).toBe("text/csv;charset=utf-8");

    const text = buildCsvText(["Tenant", "Property", "Amount"], [["Taylor Tenant", "Harbour View", 1800]]);
    expect(text).toContain("Tenant,Property,Amount");
    expect(text).toContain("Taylor Tenant,Harbour View,1800");
    expect(text.toLowerCase()).not.toContain("<!doctype html>");
  });
});
