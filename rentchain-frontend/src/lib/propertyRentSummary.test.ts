import { describe, expect, it } from "vitest";
import { calculateConfiguredUnitRentTotal, resolveConfiguredUnitRent } from "./propertyRentSummary";

describe("propertyRentSummary", () => {
  it("uses the same configured rent fallback order as the unit table", () => {
    expect(resolveConfiguredUnitRent({ rent: 1800, marketRent: 1900 })).toBe(1800);
    expect(resolveConfiguredUnitRent({ marketRent: 1900 })).toBe(1900);
    expect(resolveConfiguredUnitRent({ askingRent: 2000 })).toBe(2000);
    expect(resolveConfiguredUnitRent({ monthlyRent: 2100 })).toBe(2100);
    expect(resolveConfiguredUnitRent({})).toBeNull();
  });

  it("totals configured rents across mixed unit records", () => {
    expect(
      calculateConfiguredUnitRentTotal([
        { rent: 1800 },
        { marketRent: 1900 },
        { monthlyRent: 2100 },
        { askingRent: 2000 },
        {},
      ])
    ).toBe(7800);
  });
});
