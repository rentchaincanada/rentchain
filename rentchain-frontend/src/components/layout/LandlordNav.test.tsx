import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LandlordNav } from "./LandlordNav";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  fetchLandlordConversations: vi.fn(),
  useCapabilities: vi.fn(),
  user: { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "owner@example.com" } as {
    id: string;
    role: string;
    actorRole: string;
    email: string;
    permissions?: string[];
  },
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: mocks.logout,
    ready: true,
    isLoading: false,
    authStatus: "authed",
  }),
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilities,
}));

vi.mock("../../api/messagesApi", () => ({
  fetchLandlordConversations: mocks.fetchLandlordConversations,
}));

vi.mock("./TopNav", () => ({
  default: () => <div>Top nav</div>,
}));

vi.mock("@/features/upgradeNudges/UpgradeNudgeHost", () => ({
  UpgradeNudgeHost: () => null,
}));

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

function renderLandlordNav(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <LandlordNav>
              <div data-testid="page-content">Page content</div>
              <CurrentPath />
            </LandlordNav>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("LandlordNav mobile drawer", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  beforeEach(() => {
    mocks.user = { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "owner@example.com" };
    mocks.logout.mockReset();
    mocks.fetchLandlordConversations.mockResolvedValue([]);
    mocks.useCapabilities.mockReturnValue({
      features: {
        messaging: true,
        maintenance: true,
        portfolio_health_summary: true,
      },
      loading: false,
    });
  });

  it("opens a bottom-nav drawer with expected workspace options", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(drawer).toHaveClass("is-open");
    expect(within(drawer).getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Payments" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Work Orders" })).toBeInTheDocument();
  });

  it("keeps the mobile tab bar and close control available while the drawer is open", () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workspace pages" })).toHaveClass("active");
    expect(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Close menu",
      })
    ).toBeInTheDocument();
  });

  it("toggles the mobile drawer from the More tab", async () => {
    renderLandlordNav();

    const moreButton = screen.getByRole("button", { name: "Open workspace pages" });
    fireEvent.click(moreButton);
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toHaveClass("is-open");

    fireEvent.click(moreButton);

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toHaveClass("is-open");
    });
    expect(moreButton).not.toHaveClass("active");
  });

  it("uses a safe-area drawer offset so the sheet and backdrop stop above the mobile nav", () => {
    renderLandlordNav();

    const drawer = document.querySelector(".rc-landlord-drawer");
    const backdrop = document.querySelector(".rc-landlord-backdrop");

    expect(drawer).toHaveClass("rc-landlord-drawer--nav-safe");
    expect(backdrop).toHaveClass("rc-landlord-backdrop--nav-safe");
  });

  it("closes the drawer on option select and route change", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", { name: "Payments" }));

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toHaveClass("is-open");
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/payments");
  });

  it("uses the requested landlord mobile app tabs", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByText("Dashboard")).toBeInTheDocument();
    expect(within(tabbar).getByText("Documents")).toBeInTheDocument();
    expect(within(tabbar).getByText("Leases")).toBeInTheDocument();
    expect(within(tabbar).getByText("Inbox")).toBeInTheDocument();
    expect(within(tabbar).getByText("Messages")).toBeInTheDocument();
    expect(within(tabbar).getByText("More")).toBeInTheDocument();
    expect(within(tabbar).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Dashboard",
      "Documents",
      "Leases",
      "Inbox",
      "Messages",
      "More",
    ]);
    expect(within(tabbar).queryByText("Applications")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Tenants")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Properties")).not.toBeInTheDocument();
  });

  it("keeps the shared nav tab configuration aligned with the landlord mobile app tabs", async () => {
    const { NAV_ITEMS } = await import("./navConfig");

    expect(NAV_ITEMS.filter((item) => item.showInTabs).map((item) => item.label)).toEqual([
      "Dashboard",
      "Documents",
      "Leases",
      "Messages",
    ]);
  });

  it("navigates landlord mobile tabs to canonical routes", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Documents" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/applications");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Leases" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/leases");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Inbox" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/landlord/unified-inbox");
  });

  it("marks the unified inbox tab active on the landlord unified inbox route", () => {
    renderLandlordNav("/landlord/unified-inbox");

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByRole("button", { name: "Inbox" })).toHaveClass("active");
  });

  it("does not render the landlord bottom nav for admin role contexts", () => {
    mocks.user = { id: "admin-1", role: "admin", actorRole: "admin", email: "admin@example.com" };

    renderLandlordNav();

    expect(screen.queryByRole("navigation", { name: "Bottom navigation" })).not.toBeInTheDocument();
  });

  it("does not render the landlord bottom nav for admin permission contexts", () => {
    mocks.user = {
      id: "admin-2",
      role: "landlord",
      actorRole: "landlord",
      email: "admin@example.com",
      permissions: ["system.admin"],
    };

    renderLandlordNav();

    expect(screen.queryByRole("navigation", { name: "Bottom navigation" })).not.toBeInTheDocument();
  });

  it("closes the drawer on Escape", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toHaveClass("is-open");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toHaveClass("is-open");
    });
  });

  it("closes immediately from the drawer close button and leaves the tab bar available", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Close menu",
      })
    );

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toHaveClass("is-open");
    });
    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workspace pages" })).not.toHaveClass("active");
  });

  it("keeps messages flush so its own mobile spacing remains authoritative", () => {
    renderLandlordNav("/messages");

    expect(document.querySelector(".rc-landlord-content")).toHaveClass("rc-landlord-content--mobile-flush");
  });

  it("keeps ordinary landlord pages inside the shared mobile spacing wrapper", () => {
    renderLandlordNav("/leases");

    expect(document.querySelector(".rc-landlord-content")).not.toHaveClass("rc-landlord-content--mobile-flush");
  });
});
