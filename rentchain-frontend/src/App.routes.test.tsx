import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_TENANT_PORTAL_ENABLED", "true");

vi.mock("./components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/auth/RequireAdmin", () => ({
  RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/layout/LandlordNav", () => ({
  LandlordNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/auth/RequireTenant", () => ({
  RequireTenant: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/layout/TenantNav", () => ({
  TenantNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord_1", role: "landlord", landlordId: "landlord_1" },
    token: "test-token",
    isLoading: false,
    ready: true,
    authStatus: "authed",
  }),
}));

vi.mock("./features/automation/timeline/AutomationTimelinePage", () => ({
  default: () => <h1>Automation Timeline</h1>,
}));

vi.mock("./pages/tenant/TenantWorkspacePage", () => ({
  default: () => <h1>Tenant Workspace</h1>,
}));

vi.mock("./pages/tenant/TenantApplicationStatusPage", () => ({
  default: () => <h1>Tenant Application Status</h1>,
}));

describe("Routes: /automation/timeline", () => {
  it("renders the Automation Timeline shell and does not fall through to NotFound", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/automation/timeline"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Automation Timeline/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /tenant/application", () => {
  it("renders the tenant application route without falling into landlord surfaces", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/application"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Application Status/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
  });
});
