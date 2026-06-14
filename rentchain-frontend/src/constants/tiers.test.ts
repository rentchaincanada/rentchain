import { describe, expect, it } from "vitest";
import {
  FREE_TIER_UPGRADE_GUIDANCE,
  TIER_GUIDANCE_LINKS,
  UPGRADE_DRIVER_DESCRIPTIONS,
  UPGRADE_DRIVERS,
  getUpgradeDriversForFeature,
} from "./tiers";

describe("tier guidance constants", () => {
  it("keeps free-to-starter upgrade copy centralized without pricing references", () => {
    const copy = [
      FREE_TIER_UPGRADE_GUIDANCE.propertyCreate.body,
      FREE_TIER_UPGRADE_GUIDANCE.applications.body,
      FREE_TIER_UPGRADE_GUIDANCE.propertyOverview.body,
    ].join(" ");

    expect(copy).toContain("Free tier");
    expect(copy).toContain("Starter");
    expect(copy).not.toMatch(/\$\d/);
    expect(TIER_GUIDANCE_LINKS.upgradeDocsUrl).toBe("/pricing");
  });

  it("keeps upgrade drivers canonical for locked-state messaging", () => {
    expect(UPGRADE_DRIVERS).toEqual(["Analytics", "Payments", "Work Orders", "Expenses", "Screening"]);
    expect(Object.keys(UPGRADE_DRIVER_DESCRIPTIONS)).toEqual([...UPGRADE_DRIVERS]);
    expect(getUpgradeDriversForFeature("expenses.import")).toEqual(["Expenses", "Analytics"]);
    expect(getUpgradeDriversForFeature("ledger")).toEqual(["Payments", "Analytics"]);
    expect(getUpgradeDriversForFeature("operations_signals")).toEqual([
      "Analytics",
      "Payments",
      "Work Orders",
      "Screening",
    ]);
  });
});
