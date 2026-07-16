import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignupPage from "./SignupPage";

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  trackAuthEvent: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    signup: mocks.signup,
    isLoading: false,
    user: null,
  }),
}));

vi.mock("../lib/authAnalytics", () => ({
  trackAuthEvent: mocks.trackAuthEvent,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.signup.mockReset();
    mocks.signup.mockResolvedValue(undefined);
    mocks.trackAuthEvent.mockReset();
  });

  it("sets conversion-focused workspace expectations without changing the properties destination", () => {
    render(
      <MemoryRouter initialEntries={["/signup?next=/properties&intent=registry_readiness"]}>
        <SignupPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Create your housing operations workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "What happens next" })).toBeInTheDocument();
    expect(screen.getByText("Add your first property.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute(
      "href",
      "/login?next=%2Fproperties"
    );
  });

  it("preserves delegated access invite context during account creation", async () => {
    render(
      <MemoryRouter initialEntries={["/signup?next=/delegated-access/accept%3Ftoken%3Dsafe-token"]}>
        <SignupPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Delegated access invitation")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Delegate User" } });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "delegate@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("At least 6 characters"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByPlaceholderText("Re-enter password"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create free account" }));

    await waitFor(() =>
      expect(mocks.signup).toHaveBeenCalledWith("delegate@example.com", "secret1", "Delegate User", {
        inviteToken: "safe-token",
        inviteSource: "delegated_access",
      })
    );
  });
});
