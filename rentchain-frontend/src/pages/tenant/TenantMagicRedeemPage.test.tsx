import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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
  it("shows a warm tenant-safe retry state when the magic token is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/magic?next=/tenant/documents"]}>
        <TenantMagicRedeemPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Tenant magic link/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Missing magic link token/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Request a new link/i })).toHaveAttribute(
      "href",
      "/tenant/login?next=%2Ftenant%2Fdocuments"
    );
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
