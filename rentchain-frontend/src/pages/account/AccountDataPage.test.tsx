import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AccountDataPage from "./AccountDataPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AccountDataPage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        id: "user-1",
        email: "owner@example.com",
        actorRole: "landlord",
        actorLandlordId: "landlord-1",
        plan: "elite",
      },
    });
  });

  it("keeps account export behavior while using the scoped warm account surface", () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:account-export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <AccountDataPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Data Management" })).toBeInTheDocument();
    expect(screen.getByText("Automation Timeline: up to 24 months visible.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to My Account" })).toHaveClass("rc-account-secondary-action");
    expect(document.querySelector(".rc-account-data-page")).toHaveClass("rc-account-billing-surface");

    fireEvent.click(screen.getByRole("button", { name: "Export account JSON" }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
  });
});
