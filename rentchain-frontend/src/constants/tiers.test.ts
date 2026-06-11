import { describe, expect, it } from "vitest";
import { FREE_TIER_UPGRADE_GUIDANCE, TIER_GUIDANCE_LINKS } from "./tiers";

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
});
