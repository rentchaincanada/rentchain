import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GetTransUnionAccessModal } from "./GetTransUnionAccessModal";

describe("GetTransUnionAccessModal", () => {
  it("renders the TransUnion contact block with direct email and call actions", () => {
    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={vi.fn()}
      />
    );

    expect(screen.getByText("Chhavi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Account Executive, Inside Sales")).toBeInTheDocument();
    expect(screen.getByText("Chhavi.kumar@transunion.com")).toBeInTheDocument();
    expect(screen.getByText("289-208-7386")).toBeInTheDocument();
    expect(screen.getByText("Customer Support: 1-800-565-2280")).toBeInTheDocument();
    expect(screen.getByText("Tech Support: (877) 559-5585 Option 4")).toBeInTheDocument();
    expect(screen.getByText("clientsupport@transunion.com")).toBeInTheDocument();

    const emailLink = screen.getByRole("link", { name: "Email Chhavi Kumar" });
    expect(emailLink).toHaveAttribute("href", expect.stringContaining("mailto:Chhavi.kumar@transunion.com"));
    expect(emailLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "subject=TransUnion%20Credentialing%20Request%20for%20RentChain%20Screening"
      )
    );
    expect(emailLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "I%20would%20like%20to%20start%20the%20credentialing%20process%20for%20TransUnion%20tenant%20screening"
      )
    );

    const callLink = screen.getByRole("link", { name: "Call Chhavi Kumar" });
    expect(callLink).toHaveAttribute("href", "tel:2892087386");
  });

  it("keeps the already credentialed path in the existing connect flow", () => {
    const onEnterCredentials = vi.fn();
    render(
      <GetTransUnionAccessModal
        open
        onClose={vi.fn()}
        onMarkInProgress={vi.fn()}
        onEnterCredentials={onEnterCredentials}
      />
    );

    const buttons = screen.getAllByRole("button", { name: "Already Credentialed?" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onEnterCredentials).toHaveBeenCalledTimes(1);
  });
});
