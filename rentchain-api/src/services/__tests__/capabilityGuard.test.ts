import { describe, expect, it } from "vitest";
import { buildUpgradeRequiredResponse } from "../capabilityGuard";

describe("buildUpgradeRequiredResponse", () => {
  it("normalizes capability denial payloads for gated feature UX", () => {
    expect(
      buildUpgradeRequiredResponse({
        capability: "ledger",
        currentPlan: "free",
        source: "ledgerRoutes",
      })
    ).toEqual({
      ok: false,
      error: "upgrade_required",
      capability: "ledger",
      plan: "free",
      currentPlan: "free",
      requiredPlan: "starter",
      source: "ledgerRoutes",
      upgradePath: "/billing",
      message: "Starter is required to use this feature.",
    });
  });
});
