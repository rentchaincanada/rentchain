import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantLoginPageV2 from "./TenantLoginPage.v2";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  trackAuthEvent: vi.fn(),
}));

vi.mock("../../api/apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("../../lib/authAnalytics", () => ({
  trackAuthEvent: mocks.trackAuthEvent,
}));

describe("TenantLoginPageV2", () => {
  beforeEach(() => {
    cleanup();
    mocks.apiFetch.mockReset();
    mocks.trackAuthEvent.mockReset();
    mocks.apiFetch.mockResolvedValue({});
  });

  it("renders the shared tenant magic-link login form", () => {
    render(
      <MemoryRouter>
        <TenantLoginPageV2 />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Tenant login" })).toBeInTheDocument();
    expect(screen.getByText("Tenant access")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email me a login link" })).toBeDisabled();
  });

  it("requests a tenant magic link with the resolved safe return destination", async () => {
    render(
      <MemoryRouter initialEntries={["/tenant/login?next=/tenant/documents&token=safe-token"]}>
        <TenantLoginPageV2 />
      </MemoryRouter>
    );

    expect(screen.getByText("Invite context detected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Tenant@Example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a login link" }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/tenant/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({
          email: "tenant@example.com",
          next: "/tenant/documents",
        }),
        headers: { "Content-Type": "application/json" },
      });
    });
    expect(mocks.trackAuthEvent).toHaveBeenCalledWith(
      "auth.onboard.magic_link_requested",
      expect.objectContaining({
        source: "tenant-login",
        destination: "/tenant/documents",
      })
    );
    expect(
      screen.getByText("If an account exists for that email, we sent a login link.")
    ).toBeInTheDocument();
  });
});
