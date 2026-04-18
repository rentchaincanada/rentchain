import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradePromptModal } from "./UpgradePromptModal";

const mocks = vi.hoisted(() => ({
  startCheckout: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/billing/startCheckout", () => ({
  startCheckout: mocks.startCheckout,
}));

vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UpgradePromptModal", () => {
  it("uses shared plan normalization for display and checkout", () => {
    render(
      <MemoryRouter>
        <UpgradePromptModal
          open
          onClose={vi.fn()}
          featureKey="tenant_invites"
          currentPlan="core"
          source="unit_test"
          redirectTo="/applications"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Current: Starter")).toBeInTheDocument();
    expect(screen.getByText("Needed: Starter")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to Starter checkout" }));

    expect(mocks.startCheckout).toHaveBeenCalledWith({
      tier: "starter",
      interval: "monthly",
      requiredPlan: "starter",
      featureKey: "tenant_invites",
      source: "unit_test",
      redirectTo: "/applications",
    });
    expect(mocks.track).toHaveBeenCalledWith("upgrade_prompt_checkout_clicked", {
      featureKey: "tenant_invites",
      currentPlan: "core",
      requiredPlan: "starter",
      source: "unit_test",
      route: "/",
      presentation: "modal",
      interval: "monthly",
      targetPlan: "starter",
    });
  });

  it("tracks dismissals through the prompt modal", () => {
    render(
      <MemoryRouter>
        <UpgradePromptModal
          open
          onClose={vi.fn()}
          featureKey="tenant_invites"
          currentPlan="free"
          source="unit_test"
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Not now" })[0]);

    expect(mocks.track).toHaveBeenCalledWith("upgrade_prompt_dismissed", {
      featureKey: "tenant_invites",
      currentPlan: "free",
      requiredPlan: "starter",
      source: "unit_test",
      route: "/",
      presentation: "modal",
    });
  });
});
