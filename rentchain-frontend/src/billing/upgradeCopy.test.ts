import { describe, expect, it } from "vitest";
import { getUpgradeCopy } from "./upgradeCopy";

describe("getUpgradeCopy", () => {
  it("keeps exports messaging honest about manual tracking on free", () => {
    const copy = getUpgradeCopy("exports");
    expect(copy.title).toContain("accountant-ready exports");
    expect(copy.subtitle).toContain("Manual expense tracking stays available now");
  });

  it("describes screening as a guided workflow instead of instant automation", () => {
    const copy = getUpgradeCopy("tenant_screening");
    expect(copy.subtitle).toContain("Guided screening requests");
    expect(copy.bullets.join(" ")).toContain("request to review");
  });

  it("centralizes operations locked-state copy", () => {
    const copy = getUpgradeCopy("operations_signals");
    expect(copy.title).toContain("operations signals");
    expect(copy.subtitle).toContain("Starter");
    expect(copy.bullets.join(" ")).toContain("free-safe dashboard context");
  });
});
