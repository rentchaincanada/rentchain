import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantMagicRedeemPage from "./TenantMagicRedeemPage";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  trackAuthEvent: vi.fn(),
}));

vi.mock("../../api/apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("../../lib/authAnalytics", () => ({
  fingerprintToken: (value: string) => `fp:${value}`,
  trackAuthEvent: mocks.trackAuthEvent,
}));

describe("TenantMagicRedeemPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a warm tenant-safe retry state when the magic token is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/magic?next=/tenant/documents"]}>
        <TenantMagicRedeemPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Tenant magic link/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Missing magic link token/i));
    expect(screen.getByRole("link", { name: /Request a new link/i })).toHaveAttribute(
      "href",
      "/tenant/login?next=%2Ftenant%2Fdocuments"
    );
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("keeps invalid magic-link errors obvious and actionable", async () => {
    mocks.apiFetch.mockRejectedValue(new Error("This link is invalid or expired."));

    render(
      <MemoryRouter initialEntries={["/auth/magic?token=bad-token&next=/tenant/payments"]}>
        <TenantMagicRedeemPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Verifying your magic link/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/This link is invalid or expired/i));
    expect(screen.getByRole("link", { name: /Request a new link/i })).toHaveAttribute(
      "href",
      "/tenant/login?next=%2Ftenant%2Fpayments"
    );
    expect(mocks.trackAuthEvent).toHaveBeenCalledWith(
      "auth.onboard.failed",
      expect.objectContaining({
        phase: "magic_redeem",
      })
    );
  });
});
