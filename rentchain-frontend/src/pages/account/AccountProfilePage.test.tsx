import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AccountProfilePage from "./AccountProfilePage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

afterEach(() => {
  cleanup();
});

describe("AccountProfilePage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        email: "owner@example.com",
        id: "user-1",
        actorRole: "landlord",
        actorLandlordId: "landlord-1",
      },
    });
  });

  it("uses the scoped warm account surface without changing read-only profile fields", () => {
    render(
      <MemoryRouter>
        <AccountProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("owner@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("user-1")).toBeInTheDocument();
    expect(screen.getByText("Profile editing will be enabled in a future release.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to My Account" })).toHaveClass("rc-account-secondary-action");
    expect(document.querySelector(".rc-account-profile-page")).toHaveClass("rc-account-billing-surface");
  });
});
