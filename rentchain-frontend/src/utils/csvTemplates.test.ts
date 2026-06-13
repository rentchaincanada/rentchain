import { describe, expect, it } from "vitest";
import { buildUnitsCsvTemplate } from "./csvTemplates";

describe("csvTemplates", () => {
  it("includes optional occupancy metadata columns in the units CSV template", () => {
    const template = buildUnitsCsvTemplate();

    expect(template.split("\n")[0]).toBe("unitNumber,marketRent,beds,baths,sqft,status,occupantName,leaseEndDate");
    expect(template).toContain("occupied,Jane Tenant,2027-06-10");
  });
});
