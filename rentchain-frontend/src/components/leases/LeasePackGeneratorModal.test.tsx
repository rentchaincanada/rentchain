import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeasePackGeneratorModal } from "./LeasePackGeneratorModal";

vi.mock("@/api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

describe("LeasePackGeneratorModal accessibility", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders as a labelled dialog with a labelled property selector", () => {
    render(
      <LeasePackGeneratorModal
        open
        onClose={vi.fn()}
        initialPropertyId="property-1"
        properties={[{ id: "property-1", name: "Coburg Rd", province: "NS" } as any]}
      />
    );

    expect(screen.getByRole("dialog", { name: "Generate Lease Pack" })).toBeInTheDocument();
    expect(screen.getByLabelText("Property")).toHaveValue("property-1");
    expect(screen.getByRole("link", { name: /Download .* bundle/i })).toHaveAttribute("download");
  });

  it("closes with Escape and restores focus", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Generate</button>
        <LeasePackGeneratorModal open={false} onClose={onClose} properties={[]} />
      </>
    );
    const trigger = screen.getByRole("button", { name: "Generate" });
    trigger.focus();

    rerender(
      <>
        <button type="button">Generate</button>
        <LeasePackGeneratorModal
          open
          onClose={onClose}
          initialPropertyId="property-1"
          properties={[{ id: "property-1", name: "Coburg Rd", province: "NS" } as any]}
        />
      </>
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});
