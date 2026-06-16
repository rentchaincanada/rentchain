import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SigningCompletePage from "./SigningCompletePage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => mocks.useAuth(),
}));

describe("SigningCompletePage", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({
      user: null,
      ready: true,
      isLoading: false,
    });
  });

  it("renders an unauthenticated safe completion state without private data", () => {
    render(
      <MemoryRouter initialEntries={["/signing/complete?signature_request_id=raw-secret"]}>
        <SigningCompletePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Lease signing completed" })).toBeInTheDocument();
    expect(screen.getByText("You may close this page or return to RentChain.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(document.body.textContent).not.toContain("raw-secret");
    expect(document.body.textContent).not.toContain("signature_request_id");
  });

  it("renders role-aware navigation when a user session is available", () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "tenant-1", email: "tenant@example.com", role: "tenant" },
      ready: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SigningCompletePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Return to tenant portal" })).toHaveAttribute("href", "/tenant");
  });
});
