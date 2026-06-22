import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DelegatedAccessAcceptPage from "./DelegatedAccessAcceptPage";

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  authState: {
    user: { id: "delegate-user-1", email: "delegate@example.com", role: "landlord_delegate" },
    isLoading: false,
    ready: true,
    authStatus: "authed",
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
      user: { id: "delegate-user-1", email: "delegate@example.com", role: "landlord_delegate" },
      isLoading: false,
      ready: true,
      authStatus: "authed",
    };
    mocks.acceptInvitation.mockResolvedValue({
      ok: true,
      invitation: { status: "accepted" },
      grant: { status: "active" },
    });
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
    };

    renderPage();

    expect(screen.getByRole("heading", { name: "Accept delegated access invitation" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to accept this invitation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to accept" })).toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts a valid token on click and shows the accepted state", async () => {
    renderPage("/delegated-access/accept?token=valid-token");

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(mocks.acceptInvitation).toHaveBeenCalledWith("valid-token"));
    expect(await screen.findByText("Delegated access is now active for your account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Dashboard" })).toBeInTheDocument();
  });

  it("shows safe failure messaging without exposing the token", async () => {
    mocks.acceptInvitation.mockRejectedValueOnce(new Error("INVITATION_EXPIRED raw-token-should-not-render"));

    renderPage("/delegated-access/accept?token=raw-token-should-not-render");

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired.");
    expect(screen.queryByText("raw-token-should-not-render")).not.toBeInTheDocument();
  });
});
