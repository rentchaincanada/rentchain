import { describe, expect, it } from "vitest";
import { isUpgradeRequiredError } from "./gatedFeatureErrors";

describe("isUpgradeRequiredError", () => {
  it("recognizes normalized and legacy upgrade denial messages", () => {
    expect(isUpgradeRequiredError(new Error("upgrade_required"))).toBe(true);
    expect(isUpgradeRequiredError(new Error("Upgrade required"))).toBe(true);
    expect(isUpgradeRequiredError(new Error("Starter is required to use this feature."))).toBe(true);
  });

  it("does not classify ordinary failures as locked feature states", () => {
    expect(isUpgradeRequiredError(new Error("Failed to load ledger"))).toBe(false);
    expect(isUpgradeRequiredError(null)).toBe(false);
  });
});
