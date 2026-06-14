import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LockedFeature } from "./LockedFeature";

vi.mock("@/context/useAuth", () => ({
  useAuth: () => ({
    user: {
      plan: "free",
    },
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

describe("LockedFeature", () => {
  it("renders feature name, tier, upgrade drivers, and CTA copy", () => {
    render(
      <LockedFeature
        featureKey="expenses.import"
        featureName="Expense import and exports"
        requiredTier="pro"
        upgradeDrivers={["Expenses", "Analytics"]}
        ctaLabel="Upgrade to Pro"
      />
    );

    expect(screen.getByText("Expense import and exports")).toBeInTheDocument();
    expect(screen.getByText("Available on Pro")).toBeInTheDocument();
    expect(screen.getByText("Upgrade drivers: Expenses, Analytics")).toBeInTheDocument();
    expect(screen.getByText("Import, review, and export accountant-ready expense records.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
  });
});
