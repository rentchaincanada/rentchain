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

  it("opens a modal workspace drawer with expected workspace options", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(drawer).toHaveClass("is-open");
    expect(within(drawer).getByLabelText("Workspace destinations")).toHaveAttribute("tabindex", "0");
    expect(within(drawer).getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Operations" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Payments" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Work Orders" })).toBeInTheDocument();
  });

  it("renders a sticky workspace context bar with primary landlord workspace links", () => {
    renderLandlordNav("/payments");

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    const shell = document.querySelector(".rc-landlord-topnav");
    const content = document.querySelector(".rc-landlord-content");

    expect(shell).toBeInTheDocument();
    expect(content).toHaveClass("rc-landlord-content--sticky-offset");
    expect(shell?.nextElementSibling).toBe(document.querySelector(".rc-landlord-mobile-topbar"));
    expect(context).toHaveTextContent("Current workspace");
    expect(context).toHaveTextContent("Payments");
    expect(within(workspaceNav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(within(workspaceNav).getByRole("link", { name: "Operations" })).toHaveAttribute("href", "/operations");
    expect(within(workspaceNav).getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties");
    expect(within(workspaceNav).getByRole("link", { name: "Tenants" })).toHaveAttribute("href", "/tenants");
    expect(within(workspaceNav).getByRole("link", { name: "Leases" })).toHaveAttribute("href", "/leases");
    expect(within(workspaceNav).getByRole("link", { name: "Payments" })).toHaveClass("active");
    expect(within(workspaceNav).queryByRole("group", { name: "Communications" })).not.toBeInTheDocument();
    expect(within(workspaceNav).queryByRole("link", { name: "Unified Inbox" })).not.toBeInTheDocument();
    expect(within(workspaceNav).queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
    expect(within(workspaceNav).queryByRole("link", { name: "Notices" })).not.toBeInTheDocument();
    expect(within(workspaceNav).getByRole("link", { name: "Work Orders" })).toHaveAttribute("href", "/work-orders");
  });

  it("renders page content in the offset shell region below sticky navigation", () => {
    renderLandlordNav("/operations");

    const topNav = document.querySelector(".rc-landlord-topnav");
    const content = document.querySelector(".rc-landlord-content");

    expect(topNav).toBeInTheDocument();
    expect(content).toHaveClass("rc-landlord-content--sticky-offset");
    expect(content).toContainElement(screen.getByTestId("page-content"));
  });

  it("stores the measured fixed shell height for the content offset", async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
      const height = this.classList.contains("rc-landlord-topnav") ? 148 : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        width: 0,
        height,
        toJSON: () => ({}),
      };
    });

    renderLandlordNav("/dashboard");

    await waitFor(() => {
      expect((document.querySelector(".rc-landlord-shell") as HTMLElement).style.getPropertyValue("--rc-landlord-sticky-shell-measured-height")).toBe("148px");
    });

    rectSpy.mockRestore();
  });

  it("keeps canonical inbox context visible for legacy landlord inbox paths", () => {
    renderLandlordNav("/landlord/inbox");

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });

    expect(context).toHaveTextContent("Unified Inbox");
    expect(within(workspaceNav).queryByRole("link", { name: "Unified Inbox" })).not.toBeInTheDocument();
    expect(screen.getByText("Unified Inbox", { selector: ".rc-landlord-mobile-role" })).toBeInTheDocument();
  });

  it("keeps delegate management in the sticky workspace shell", () => {
    renderLandlordNav("/account/delegated-access");

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    const topNav = document.querySelector(".rc-landlord-topnav");
    const content = document.querySelector(".rc-landlord-content");

    expect(topNav).toBeInTheDocument();
    expect(content).toHaveClass("rc-landlord-content--sticky-offset");
    expect(context).toHaveTextContent("Delegate Management");
    expect(within(workspaceNav).getByRole("link", { name: "Delegate Management" })).toHaveClass("active");
    expect(screen.getByText("Delegate Management", { selector: ".rc-landlord-mobile-role" })).toBeInTheDocument();
  });

  it("keeps PM company management in the sticky workspace shell", () => {
    renderLandlordNav("/account/property-manager-companies");

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });

    expect(context).toHaveTextContent("PM Companies");
    expect(within(workspaceNav).getByRole("link", { name: "PM Companies" })).toHaveClass("active");
    expect(screen.getByText("PM Companies", { selector: ".rc-landlord-mobile-role" })).toBeInTheDocument();
  });

  it("keeps verified screenings inside the landlord shell with bottom navigation", () => {
    renderLandlordNav("/verified-screenings");

    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
    expect(screen.getByText("Verified Screenings", { selector: ".rc-landlord-mobile-role" })).toBeInTheDocument();
  });

  it("opens the workspace sheet above the mobile tab bar", () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workspace pages" })).toHaveClass("active");
    expect(document.querySelector(".rc-landlord-backdrop")).toHaveClass("is-open");
    expect(document.querySelector(".rc-landlord-backdrop")).toHaveClass("rc-landlord-backdrop--nav-safe");
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
      expect(document.querySelector("#rc-landlord-drawer")).not.toBeInTheDocument();
    });
    expect(moreButton).not.toHaveClass("active");
  });

  it("uses nav-safe bottom offsets so the sheet opens above the mobile nav", () => {
    renderLandlordNav();

    expect(document.querySelector(".rc-landlord-drawer")).not.toBeInTheDocument();
    expect(document.querySelector(".rc-landlord-backdrop")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const drawer = document.querySelector(".rc-landlord-drawer");
    const backdrop = document.querySelector(".rc-landlord-backdrop");

    expect(drawer).toHaveClass("rc-landlord-drawer--nav-safe");
    expect(backdrop).toHaveClass("rc-landlord-backdrop--nav-safe");
  });

  it("keeps the mobile bottom nav usable while the workspace sheet is open", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Properties" }));

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/properties");
  });

  it("closes the drawer on option select and route change", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", { name: "Payments" }));

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/payments");
  });

  it("uses the free-tier landlord mobile app tabs in setup order", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByText("Dashboard")).toBeInTheDocument();
    expect(within(tabbar).getByText("Properties")).toBeInTheDocument();
    expect(within(tabbar).getByText("Applicants")).toBeInTheDocument();
    expect(within(tabbar).getByText("Unified Inbox")).toBeInTheDocument();
    expect(within(tabbar).getByText("Operations")).toBeInTheDocument();
    expect(within(tabbar).getByText("More")).toBeInTheDocument();
    expect(within(tabbar).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Dashboard",
      "Properties",
      "Applicants",
      "Unified Inbox",
      "Operations",
      "More",
    ]);
    expect(within(tabbar).queryByText("Tenants")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Leases")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Messages")).not.toBeInTheDocument();
  });

  it("keeps the shared nav tab configuration aligned with the landlord mobile app tabs", async () => {
    const { NAV_ITEMS } = await import("./navConfig");

    expect(NAV_ITEMS.filter((item) => item.showInTabs).map((item) => item.label)).toEqual([
      "Dashboard",
      "Properties",
      "Applications",
      "Unified Inbox",
    ]);
    expect(NAV_ITEMS.find((item) => item.id === "operations")).toEqual(
      expect.objectContaining({
        label: "Operations",
        to: "/operations",
        showInDrawer: true,
      })
    );
  });

  it("shows distinct landlord drawer entries for the unified inbox and direct messages", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    const communications = within(drawer).getByRole("group", { name: "Communications" });
    const inboxButtons = within(communications).getAllByRole("button", { name: "Unified Inbox" });
    expect(inboxButtons).toHaveLength(1);
    expect(within(communications).getByRole("button", { name: "Messages" })).toBeInTheDocument();
    expect(within(communications).getByRole("button", { name: "Notices" })).toBeInTheDocument();

    fireEvent.click(inboxButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/landlord/unified-inbox");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Messages",
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/messages");
    });
  });

  it("navigates landlord mobile tabs to canonical routes", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Properties" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/properties");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Applicants" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/applications");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Unified Inbox" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/landlord/unified-inbox");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Operations" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/operations");
  });

  it("marks the Operations tab active on the operations route", () => {
    renderLandlordNav("/operations");

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByRole("button", { name: "Operations" })).toHaveClass("active");
  });

  it("marks the unified inbox tab active on the landlord unified inbox route", () => {
    renderLandlordNav("/landlord/unified-inbox");

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByRole("button", { name: "Unified Inbox" })).toHaveClass("active");
    expect(within(tabbar).getByRole("button", { name: "Unified Inbox" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["/landlord/unified-inbox", "Unified Inbox"],
    ["/messages", "Messages"],
    ["/notices", "Notices"],
  ])("keeps route-specific titles and active Communications menu items for %s", (path, label) => {
    renderLandlordNav(path);

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    fireEvent.click(screen.getByRole("button", { name: "Communications" }));
    const communications = screen.getByRole("menu", { name: "Communications destinations" });
    const activeChild = within(communications).getByRole("menuitem", { name: label });

    expect(within(workspaceNav).queryByRole("group", { name: "Communications" })).not.toBeInTheDocument();
    expect(activeChild).toHaveAttribute("aria-current", "page");
    expect(context.querySelector("strong")).toHaveTextContent(label);
    expect(screen.getByText(label, { selector: ".rc-landlord-mobile-role" })).toBeInTheDocument();
    if (label !== "Unified Inbox") {
      expect(context.querySelector("strong")).not.toHaveTextContent("Inbox");
      expect(context.querySelector("strong")).not.toHaveTextContent("Workspace");
    }
  });

  it.each([
    ["/landlord/unified-inbox", "Unified Inbox"],
    ["/messages", "Messages"],
    ["/notices", "Notices"],
  ])("keeps the canonical Communications shell available when messaging capability is false at %s", (path, label) => {
    mocks.useCapabilities.mockReturnValue({
      features: { messaging: false },
      loading: false,
    });

    renderLandlordNav(path);

    const context = screen.getByLabelText("Workspace context");
    fireEvent.click(screen.getByRole("button", { name: "Communications" }));
    const communications = screen.getByRole("menu", { name: "Communications destinations" });

    expect(within(communications).getAllByRole("menuitem").map((link) => link.textContent?.replace("✓", ""))).toEqual([
      "Unified Inbox",
      "Messages",
      "Notices",
    ]);
    expect(within(communications).getByRole("menuitem", { name: label })).toHaveAttribute("aria-current", "page");
    expect(context.querySelector("strong")).toHaveTextContent(label);
    expect(context.querySelector("strong")).not.toHaveTextContent("Workspace");
  });

  it("marks the active Communications child in the responsive drawer", () => {
    renderLandlordNav("/notices");

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    const communications = within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("group", {
      name: "Communications",
    });

    expect(within(communications).getByRole("button", { name: "Notices" })).toHaveAttribute("aria-current", "page");
    expect(within(communications).getByRole("button", { name: "Messages" })).not.toHaveAttribute("aria-current");
    expect(within(communications).getByRole("button", { name: "Unified Inbox" })).not.toHaveAttribute("aria-current");
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
      expect(document.querySelector("#rc-landlord-drawer")).not.toBeInTheDocument();
    });
  });

  it("closes immediately from the drawer close button and restores the tab bar", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Close menu",
      })
    );

    await waitFor(() => {
      expect(document.querySelector("#rc-landlord-drawer")).not.toBeInTheDocument();
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
