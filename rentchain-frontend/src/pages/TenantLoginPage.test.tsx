import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantLoginPage from "./TenantLoginPage";

const mocks = vi.hoisted(() => ({
  tenantLogin: vi.fn(),
  setAuthToken: vi.fn(),
}));

vi.mock("../api/tenantAuthApi", () => ({
  tenantLogin: mocks.tenantLogin,
}));

vi.mock("../lib/apiClient", () => ({
  setAuthToken: mocks.setAuthToken,
}));

describe("TenantLoginPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.tenantLogin.mockReset();
    mocks.setAuthToken.mockReset();
    mocks.tenantLogin.mockResolvedValue({ token: "tenant-token" });
  });

  it("renders the shared tenant password login form", () => {
    render(
      <MemoryRouter>
        <TenantLoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Tenant login" })).toBeInTheDocument();
    expect(screen.getByText("Tenant access")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("preserves tenant login token storage and return navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/tenant/login?returnTo=/tenant/documents"]}>
        <Routes>
          <Route path="/tenant/login" element={<TenantLoginPage />} />
          <Route path="/tenant/documents" element={<h1>Tenant documents</h1>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "tenant@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "tenant-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mocks.tenantLogin).toHaveBeenCalledWith("tenant@example.com", "tenant-password");
      expect(mocks.setAuthToken).toHaveBeenCalledWith("tenant-token");
      expect(screen.getByRole("heading", { name: "Tenant documents" })).toBeInTheDocument();
    });
  });

  it("renders a safe error when the tenant login request fails", async () => {
    mocks.tenantLogin.mockRejectedValueOnce(new Error("Login failed"));

    render(
      <MemoryRouter>
        <TenantLoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "tenant@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "bad-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Login failed");
  });
});
