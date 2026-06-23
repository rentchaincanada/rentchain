import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DelegatedAccessAcceptPage from "./DelegatedAccessAcceptPage";

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  logout: vi.fn(),
  authState: {
    user: { id: "delegate-user-1", email: "delegate@example.com", role: "delegate" },
    isLoading: false,
    ready: true,
    authStatus: "authed",
    logout: vi.fn(),
  } as any,
}));

vi.mock("../api/delegatedAccessApi", () => ({
  acceptDelegatedAccessInvitation: mocks.acceptInvitation,
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => mocks.authState,
}));

function renderPage(path = "/delegated-access/accept?token=test-token") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DelegatedAccessAcceptPage />
    </MemoryRouter>
  );
}

describe("DelegatedAccessAcceptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState = {
      user: { id: "delegate-user-1", email: "delegate@example.com", role: "delegate" },
      isLoading: false,
      ready: true,
      authStatus: "authed",
      logout: mocks.logout,
    };
    mocks.acceptInvitation.mockResolvedValue({
      ok: true,
      invitation: { status: "accepted" },
      grant: { status: "active" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a safe invalid-link state when token is missing", () => {
    renderPage("/delegated-access/accept");

    expect(screen.getByRole("heading", { name: "Invalid invitation link" })).toBeInTheDocument();
    expect(screen.getByText(/missing required information/i)).toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("shows sign-in guidance without calling the API when unauthenticated", () => {
    mocks.authState = {
      user: null,
      isLoading: false,
      ready: true,
      authStatus: "guest",
      logout: mocks.logout,
    };

    renderPage();

    expect(screen.getByRole("heading", { name: "Accept delegated access invitation" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to accept this invitation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account to accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to accept" })).toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts a valid token on click and shows the accepted state", async () => {
    renderPage("/delegated-access/accept?token=valid-token");

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(mocks.acceptInvitation).toHaveBeenCalledWith("valid-token"));
    expect(await screen.findByText("Delegated access is now active for your account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to delegated workspace" })).toBeInTheDocument();
  });

  it("shows safe failure messaging without exposing the token", async () => {
    mocks.acceptInvitation.mockRejectedValueOnce(new Error("INVITATION_EXPIRED raw-token-should-not-render"));

    renderPage("/delegated-access/accept?token=raw-token-should-not-render");

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired.");
    expect(screen.queryByText("raw-token-should-not-render")).not.toBeInTheDocument();
  });

  it("explains wrong-email sessions and signs out before using another account", async () => {
    mocks.acceptInvitation.mockRejectedValueOnce(new Error("INVITEE_EMAIL_MISMATCH"));

    renderPage("/delegated-access/accept?token=valid-token");

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invitation was sent to a different email. Sign out and sign in with the invited email."
    );
    fireEvent.click(screen.getByRole("button", { name: "Use another account" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });
});
