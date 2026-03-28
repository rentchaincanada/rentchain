import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireTenant } from "./RequireTenant";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getTenantTokenMock: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../../lib/tenantAuth", () => ({
  getTenantToken: mocks.getTenantTokenMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RequireTenant", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
    });
    mocks.getTenantTokenMock.mockReturnValue("");
  });

  it("redirects to tenant login when no tenant token exists", () => {
    render(
      <MemoryRouter initialEntries={["/tenant/dashboard"]}>
        <Routes>
          <Route
            path="/tenant/dashboard"
            element={
              <RequireTenant>
                <div>Tenant area</div>
              </RequireTenant>
            }
          />
          <Route path="/tenant/login" element={<div>Tenant login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText("Tenant area")).not.toBeInTheDocument();
    expect(screen.getByText("Tenant login")).toBeInTheDocument();
  });

  it("allows tenant portal access when a tenant token exists even if auth user is stale landlord state", () => {
    mocks.useAuthMock.mockReturnValue({
      user: { role: "landlord", actorRole: "landlord" },
      isLoading: false,
    });
    mocks.getTenantTokenMock.mockReturnValue("tenant-token");

    render(
      <MemoryRouter initialEntries={["/tenant/dashboard"]}>
        <Routes>
          <Route
            path="/tenant/dashboard"
            element={
              <RequireTenant>
                <div>Tenant area</div>
              </RequireTenant>
            }
          />
          <Route path="/tenant/login" element={<div>Tenant login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Tenant area")).toBeInTheDocument();
    expect(screen.queryByText("Tenant login")).not.toBeInTheDocument();
  });
});
