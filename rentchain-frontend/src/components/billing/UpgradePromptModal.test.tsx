import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradePromptModal } from "./UpgradePromptModal";

const mocks = vi.hoisted(() => ({
  startCheckout: vi.fn(),
}));

vi.mock("@/billing/startCheckout", () => ({
  startCheckout: mocks.startCheckout,
}));

afterEach(() => {
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

    fireEvent.click(screen.getByRole("button", { name: "See upgrade options" }));

    expect(mocks.startCheckout).toHaveBeenCalledWith({
      tier: "starter",
      interval: "monthly",
      requiredPlan: "starter",
      featureKey: "tenant_invites",
      source: "unit_test",
      redirectTo: "/applications",
    });
  });
});
