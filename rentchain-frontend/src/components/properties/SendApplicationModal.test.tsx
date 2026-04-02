import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendApplicationModal } from "./SendApplicationModal";
import { createApplicationLink } from "../../api/applicationLinksApi";

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

afterEach(() => {
  cleanup();
});

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

  it("requires an explicit property choice when multiple properties are available", () => {
    render(
      <SendApplicationModal
        open
        properties={[
          { id: "prop-1", name: "Harbour View" },
          { id: "prop-2", name: "Maple House" },
        ]}
        units={[]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("option", { name: "Select a property" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate link" })).toBeDisabled();
  });

  it("auto-selects the single available property and generates an application link", async () => {
    vi.mocked(createApplicationLink).mockResolvedValue({
      ok: true,
      data: {
        url: "/apply/token-123",
      },
      emailed: true,
    } as any);

    render(
      <SendApplicationModal
        open
        properties={[{ id: "prop-1", name: "Harbour View" }]}
        units={[{ id: "unit-1", name: "Unit 1A" }]}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("applicant@email.com"), {
      target: { value: "applicant@example.com" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "unit-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate link" }));

    await waitFor(() => {
      expect(createApplicationLink).toHaveBeenCalledWith({
        propertyId: "prop-1",
        unitId: "unit-1",
        applicantEmail: "applicant@example.com",
      });
    });

    expect(await screen.findByDisplayValue("http://localhost:3000/apply/token-123")).toBeInTheDocument();
  });
});
