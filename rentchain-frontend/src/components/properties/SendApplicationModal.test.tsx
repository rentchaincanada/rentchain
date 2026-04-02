import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SendApplicationModal } from "./SendApplicationModal";

vi.mock("../../api/applicationLinksApi", () => ({
  createApplicationLink: vi.fn(),
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

vi.mock("../../lib/analytics", () => ({
  track: vi.fn(),
}));

describe("SendApplicationModal", () => {
  it("shows an intentional upgrade state instead of a dead generate action", () => {
    const onUpgradeRequired = vi.fn();

    render(
      <SendApplicationModal
        open
        propertyId="prop-1"
        propertyName="Harbour View"
        properties={[{ id: "prop-1", name: "Harbour View" }]}
        allowGeneration={false}
        lockedMessage="Starter unlocks secure application links."
        onUpgradeRequired={onUpgradeRequired}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Upgrade to send application links")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Starter" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate link" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Starter" }));
    expect(onUpgradeRequired).toHaveBeenCalledTimes(1);
  });
});
