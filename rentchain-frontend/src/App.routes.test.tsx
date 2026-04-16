import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  cleanup();
  mockTenantToken = null;
});

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

let mockTenantToken: string | null = null;

vi.mock("./context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord_1", role: "landlord", landlordId: "landlord_1" },
    token: "test-token",
    isLoading: false,
    ready: true,
    authStatus: "authed",
  }),
}));

vi.mock("./lib/tenantAuth", () => ({
  getTenantToken: () => mockTenantToken,
}));

vi.mock("./features/automation/timeline/AutomationTimelinePage", () => ({
  default: () => <h1>Automation Timeline</h1>,
}));

vi.mock("./pages/admin/AutomationTimelineV1Page", () => ({
  default: () => <h1>Automation Timeline v1</h1>,
}));

vi.mock("./pages/admin/SupportDebugConsolePage", () => ({
  default: () => <h1>Support / Debug Console</h1>,
}));

vi.mock("./pages/admin/AdminTriageQueuePage", () => ({
  default: () => <h1>Admin Triage Queue</h1>,
}));

vi.mock("./pages/admin/AdminAlertingPage", () => ({
  default: () => <h1>Admin Alerts</h1>,
}));

vi.mock("./pages/admin/PortfolioScorePage", () => ({
  default: () => <h1>Portfolio Score Foundation</h1>,
}));

vi.mock("./pages/admin/PortfolioScoreHistoryPage", () => ({
  default: () => <h1>Portfolio Score History</h1>,
}));

vi.mock("./pages/landlord/PortfolioHealthSummaryPage", () => ({
  default: () => <h1>Portfolio Health Summary</h1>,
}));

vi.mock("./pages/landlord/PortfolioScorePage", () => ({
  default: () => <h1>Landlord Portfolio Score</h1>,
}));

vi.mock("./pages/tenant/TenantWorkspacePage", () => ({
  default: () => <h1>Tenant Dashboard</h1>,
}));

vi.mock("./pages/tenant/TenantApplicationStatusPage", () => ({
  default: () => {
    const location = useLocation();
    return <h1>{`Tenant Application Status ${location.pathname}${location.search}`}</h1>;
  },
}));

describe("Routes: /tenant", () => {
  it("renders the tenant-first landing page without landlord pricing content", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Your rental profile\. Secure, organized, and in your control\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Create free account/i)).not.toBeInTheDocument();
  });

  it("redirects authenticated tenants from the public tenant entry page to the tenant dashboard", async () => {
    mockTenantToken = "header.payload.signature";
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Dashboard/i)).toBeInTheDocument();
  });

  it("restores a safe preserved tenant route when an authenticated tenant lands on /tenant", async () => {
    mockTenantToken = "header.payload.signature";
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant?next=%2Ftenant%2Fapplication"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Tenant Application Status \/tenant\/application/i)
    ).toBeInTheDocument();
  });
});

describe("Routes: /tenant/dashboard", () => {
  it("renders the tenant dashboard route without falling into landlord surfaces", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/DashboardPage/i)).not.toBeInTheDocument();
  });
});

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

describe("Routes: /timeline", () => {
  it("renders the canonical automation timeline admin view", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/timeline"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Automation Timeline v1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/support-console", () => {
  it("renders the admin support/debug console route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/support-console"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Support \/ Debug Console/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/triage", () => {
  it("renders the admin triage queue route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/triage"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Admin Triage Queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/alerts", () => {
  it("renders the admin alerting route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/alerts"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Admin Alerts/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/portfolio-score", () => {
  it("renders the admin portfolio score route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/portfolio-score"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Score Foundation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/portfolio-score/history", () => {
  it("renders the admin portfolio score history route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/portfolio-score/history"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Score History/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /portfolio-health", () => {
  it("renders the landlord portfolio health route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/portfolio-health"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Health Summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /portfolio-score", () => {
  it("renders the landlord portfolio score route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/portfolio-score"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Landlord Portfolio Score/i)).toBeInTheDocument();
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

describe("Routes: tenant application aliases", () => {
  it("normalizes tenant apply links into the tenant application flow", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/apply/app-123"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Tenant Application Status \/tenant\/application\?entry=application&applicationToken=app-123/i)
    ).toBeInTheDocument();
  });

  it("normalizes tenant invite redeem aliases into a tokenized redeem route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/invite/redeem/invite-123"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("textbox", { name: /Invite token/i })).toHaveValue("invite-123");
  });
});
