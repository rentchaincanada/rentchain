import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireTenant } from "./RequireTenant";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getTenantTokenMock: vi.fn(),
  getTenantWorkspaceMock: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../../lib/tenantAuth", () => ({
  getTenantToken: mocks.getTenantTokenMock,
}));

vi.mock("../../api/tenantPortal", () => ({
  getTenantWorkspace: mocks.getTenantWorkspaceMock,
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
      ready: true,
    });
    mocks.getTenantTokenMock.mockReturnValue("");
    mocks.getTenantWorkspaceMock.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
    });
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

  it("holds the tenant shell behind a finishing sign-in state while the workspace is still hydrating", () => {
    mocks.getTenantTokenMock.mockReturnValue("tenant-token");
    mocks.getTenantWorkspaceMock.mockReturnValue(new Promise(() => undefined));

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
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText("Tenant area")).not.toBeInTheDocument();
    expect(screen.getByText(/Finishing sign-in/i)).toBeInTheDocument();
  });

  it("allows tenant portal access once the tenant workspace has hydrated", async () => {
    mocks.useAuthMock.mockReturnValue({
      user: { role: "landlord", actorRole: "landlord" },
      isLoading: false,
      ready: true,
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

    expect(await screen.findByText("Tenant area")).toBeInTheDocument();
    expect(screen.queryByText("Tenant login")).not.toBeInTheDocument();
  });

  it("redirects dashboard landings into the tenant application route when the workspace is still in applicant mode", async () => {
    mocks.getTenantTokenMock.mockReturnValue("tenant-token");
    mocks.getTenantWorkspaceMock.mockResolvedValue({
      context: {
        authority: "applicant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: null,
        tenantId: null,
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
    });

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
          <Route path="/tenant/application" element={<div>Tenant application</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant application")).toBeInTheDocument();
    expect(screen.queryByText("Tenant area")).not.toBeInTheDocument();
  });

  it("redirects back to tenant login when workspace hydration shows the token is no longer authorized", async () => {
    mocks.getTenantTokenMock.mockReturnValue("tenant-token");
    mocks.getTenantWorkspaceMock.mockRejectedValue({
      status: 401,
      payload: { error: "UNAUTHORIZED" },
      message: "UNAUTHORIZED",
    });

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

    expect(await screen.findByText("Tenant login")).toBeInTheDocument();
    expect(screen.queryByText("Tenant area")).not.toBeInTheDocument();
  });
});
