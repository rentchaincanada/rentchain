import { describe, expect, it } from "vitest";
import { comparePrimaryVsShadow } from "./compare";

describe("comparePrimaryVsShadow", () => {
  it("returns match when comparable fields are equal", () => {
    const primary = {
      provider: "transunion",
      ok: true,
      totalAmountCents: 1995,
      currency: "CAD",
      eligible: true,
      checkoutUrlPresent: true,
      orderIdPresent: true,
      errorCode: undefined,
    };

    const shadow = {
      provider: "transunion",
      ok: true,
      totalAmountCents: 1995,
      currency: "CAD",
      eligible: true,
      checkoutUrlPresent: true,
      orderIdPresent: true,
      errorCode: undefined,
    };

    const result = comparePrimaryVsShadow(primary, shadow);
    expect(result.isMatch).toBe(true);
    expect(result.fields).toEqual([]);
  });

  it("returns mismatch fields when values differ", () => {
    const result = comparePrimaryVsShadow(
      {
        provider: "transunion",
        ok: true,
        totalAmountCents: 1995,
        checkoutUrlPresent: true,
        orderIdPresent: true,
      },
      {
        provider: "mock",
        ok: false,
        totalAmountCents: 2095,
        checkoutUrlPresent: false,
        orderIdPresent: true,
        errorCode: "provider_unavailable",
      }
    );

    expect(result.isMatch).toBe(false);
    expect(result.fields).toEqual(
      expect.arrayContaining([
        "provider",
        "ok",
        "totalAmountCents",
        "checkoutUrlPresent",
        "errorCode",
      ])
    );
  });
});
