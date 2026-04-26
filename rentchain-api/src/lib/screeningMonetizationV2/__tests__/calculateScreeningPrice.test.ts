import { describe, expect, it } from "vitest";

import { calculateScreeningPrice, normalizeScreeningAddonsV2 } from "../calculateScreeningPrice";

describe("calculateScreeningPrice", () => {
  it("calculates the basic package total without add-ons", () => {
    expect(calculateScreeningPrice({ packageKey: "basic" })).toMatchObject({
      packageKey: "basic",
      packageAmountCents: 1999,
      addonAmountCents: 0,
      totalAmountCents: 1999,
      currency: "CAD",
    });
  });

  it("calculates premium pricing with multiple add-ons", () => {
    expect(
      calculateScreeningPrice({
        packageKey: "premium",
        addons: ["income_verification", "fraud_detection"],
      })
    ).toMatchObject({
      packageKey: "premium",
      packageAmountCents: 3999,
      addonAmountCents: 1298,
      totalAmountCents: 5297,
    });
  });

  it("deduplicates and filters unsupported add-ons", () => {
    expect(
      normalizeScreeningAddonsV2(["income_verification", "income_verification", "unknown", "fraud_detection"])
    ).toEqual(["income_verification", "fraud_detection"]);
  });
});
