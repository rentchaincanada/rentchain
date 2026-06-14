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
      requiredTier: "starter",
      userMessage: "Upgrade to Starter to unlock Payments, Analytics.",
      upgradeDrivers: ["Payments", "Analytics"],
      source: "ledgerRoutes",
      upgradePath: "/pricing?tier=starter",
      message: "Starter is required to use this feature.",
    });
  });

  it("includes expense upgrade drivers for import and export gates", () => {
    expect(
      buildUpgradeRequiredResponse({
        capability: "expenses.export",
        currentPlan: "free",
        source: "expensesRoutes",
      })
    ).toMatchObject({
      error: "upgrade_required",
      requiredPlan: "pro",
      requiredTier: "pro",
      userMessage: "Upgrade to Pro to unlock Expenses, Analytics.",
      upgradeDrivers: ["Expenses", "Analytics"],
      upgradePath: "/pricing?tier=pro",
    });
  });
});
