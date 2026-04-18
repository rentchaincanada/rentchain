import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeatureGate } from "./FeatureGate";
import { LockedFeature } from "./LockedFeature";

vi.mock("./UpgradeCTA", () => ({
  UpgradeCTA: ({ label }: { label?: string }) => <button type="button">{label || "Upgrade"}</button>,
}));

afterEach(() => {
  cleanup();
});

describe("FeatureGate", () => {
  it("renders children when enabled", () => {
    render(
      <FeatureGate enabled fallback={<div>Locked</div>}>
        <div>Full feature</div>
      </FeatureGate>
    );

    expect(screen.getByText("Full feature")).toBeInTheDocument();
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });

  it("renders the locked fallback when disabled", () => {
    render(
      <FeatureGate
        enabled={false}
        fallback={
          <LockedFeature
            featureKey="move_in_readiness"
            title="Move-In Readiness is available on Starter"
            description="Track deposit, inspection, insurance, keys, and blockers."
            ctaLabel="Upgrade to Starter"
          />
        }
      >
        <div>Full feature</div>
      </FeatureGate>
    );

    expect(screen.getByText("Move-In Readiness is available on Starter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Starter" })).toBeInTheDocument();
    expect(screen.getByText("Available on Starter")).toBeInTheDocument();
    expect(
      screen.getByText("Opens a quick upgrade prompt first. Checkout only begins if you choose to continue.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Full feature")).not.toBeInTheDocument();
  });
});
