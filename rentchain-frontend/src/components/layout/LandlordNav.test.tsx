import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LandlordNav } from "./LandlordNav";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  fetchLandlordConversations: vi.fn(),
  fetchUnifiedInbox: vi.fn(),
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

vi.mock("../../api/unifiedInboxApi", () => ({
  fetchUnifiedInbox: mocks.fetchUnifiedInbox,
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

function renderLandlordNav(
  initialPath = "/dashboard",
  unread?: { messages?: boolean; inbox?: boolean }
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <LandlordNav unreadMessages={unread?.messages} unreadInbox={unread?.inbox}>
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
    mocks.fetchUnifiedInbox.mockResolvedValue({ items: [], records: [] });
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
    expect(within(workspaceNav).getByRole("link", { name: "Review Needed" })).toHaveAttribute("href", "/review-needed");
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

  it("uses the five-slot landlord mobile IA with Communications primary and Operations in More", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).getByText("Dashboard")).toBeInTheDocument();
    expect(within(tabbar).getByText("Properties")).toBeInTheDocument();
    expect(within(tabbar).getByText("Applicants")).toBeInTheDocument();
    expect(within(tabbar).getByText("Communications")).toBeInTheDocument();
    expect(within(tabbar).getByText("More")).toBeInTheDocument();
    expect(within(tabbar).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Dashboard",
      "Properties",
      "Applicants",
      "Communications",
      "More",
    ]);
    expect(within(tabbar).queryByText("Tenants")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Leases")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Messages")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Operations")).not.toBeInTheDocument();

    fireEvent.click(within(tabbar).getByRole("button", { name: "Open workspace pages" }));
    expect(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Operations",
      })
    ).toBeInTheDocument();
  });

  it("keeps the shared nav tab configuration aligned with the landlord mobile app tabs", async () => {
    const { NAV_ITEMS } = await import("./navConfig");

    expect(NAV_ITEMS.filter((item) => item.showInTabs).map((item) => item.label)).toEqual([
      "Dashboard",
      "Properties",
      "Applications",
    ]);
    expect(NAV_ITEMS.find((item) => item.id === "operations")).toEqual(
      expect.objectContaining({
        label: "Operations",
        to: "/operations",
        showInDrawer: true,
      })
    );
  });

  it("keeps communication destinations out of the Workspace drawer", () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));

    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(within(drawer).queryByRole("group", { name: "Communications" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Unified Inbox" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Messages" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Notices" })).not.toBeInTheDocument();
  });

  it("navigates direct landlord tabs while Communications opens its drawer without changing route", () => {
    renderLandlordNav();

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Properties" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/properties");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Applicants" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/applications");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Communications" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/applications");
    const communicationsDrawer = screen.getByRole("dialog", { name: "Communications navigation" });
    expect(within(communicationsDrawer).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Close",
      "Unified Inbox",
      "Messages",
      "Notices",
    ]);
  });

  it("shows matching Messages and Inbox indicators in the responsive drawer without a Notices indicator", () => {
    renderLandlordNav("/dashboard", { messages: true, inbox: true });

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    const communications = within(tabbar).getByRole("button", { name: "Communications" });
    expect(communications.querySelector(".rc-landlord-mobile-tabbar-dot")).toBeInTheDocument();

    fireEvent.click(communications);
    const drawer = screen.getByRole("dialog", { name: "Communications navigation" });
    expect(within(drawer).getByRole("button", { name: "Unified Inbox, unread activity" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Messages, unread activity" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Notices" })).toBeInTheDocument();
  });

  it("keeps each unread child independent across navigation and clears the parent only when neither is unread", async () => {
    const { rerender } = renderLandlordNav("/dashboard", { messages: false, inbox: true });
    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    const communications = within(tabbar).getByRole("button", { name: "Communications" });

    fireEvent.click(communications);
    const drawer = screen.getByRole("dialog", { name: "Communications navigation" });
    expect(within(drawer).getByRole("button", { name: "Unified Inbox, unread activity" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Messages" })).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Messages" }));
    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent("/messages"));
    expect(communications.querySelector(".rc-landlord-mobile-tabbar-dot")).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <LandlordNav unreadMessages={false} unreadInbox={false}>
          <div>Page content</div>
        </LandlordNav>
      </MemoryRouter>
    );
    expect(
      screen.getByRole("navigation", { name: "Bottom navigation" }).querySelector(".rc-landlord-mobile-tabbar-dot")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["Unified Inbox", "/landlord/unified-inbox"],
    ["Messages", "/messages"],
    ["Notices", "/notices"],
  ])("navigates to %s from the Communications drawer and closes it", async (label, path) => {
    renderLandlordNav("/dashboard");

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Communications" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Communications navigation" })).getByRole("button", { name: label })
    );

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Communications navigation" })).not.toBeInTheDocument());
    expect(screen.getByTestId("current-path")).toHaveTextContent(path);
    expect(within(tabbar).getByRole("button", { name: "Communications" })).toHaveClass("active");
  });

  it("reopens Communications from child routes and never redirects until a destination is selected", () => {
    renderLandlordNav("/messages");

    const communications = within(screen.getByRole("navigation", { name: "Bottom navigation" })).getByRole("button", {
      name: "Communications",
    });
    fireEvent.click(communications);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/messages");
    expect(
      within(screen.getByRole("dialog", { name: "Communications navigation" })).getByRole("button", { name: "Messages" })
    ).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Communications navigation" })).getByRole("button", { name: "Notices" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/notices");

    fireEvent.click(communications);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/notices");
    expect(screen.getByRole("dialog", { name: "Communications navigation" })).toBeInTheDocument();
  });

  it("dismisses the Communications drawer by backdrop and Escape while restoring trigger focus", async () => {
    renderLandlordNav("/messages");

    const communications = within(screen.getByRole("navigation", { name: "Bottom navigation" })).getByRole("button", {
      name: "Communications",
    });
    fireEvent.click(communications);
    fireEvent.click(document.querySelector(".rc-landlord-backdrop") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Communications navigation" })).not.toBeInTheDocument());
    expect(communications).toHaveFocus();

    fireEvent.click(communications);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Communications navigation" })).not.toBeInTheDocument());
    expect(communications).toHaveFocus();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/messages");
  });

  it("keeps Operations reachable and active from More", () => {
    renderLandlordNav("/operations");

    const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
    expect(within(tabbar).queryByRole("button", { name: "Operations" })).not.toBeInTheDocument();
    fireEvent.click(within(tabbar).getByRole("button", { name: "Open workspace pages" }));
    expect(
      within(screen.getByRole("dialog", { name: "Navigation menu" })).getByRole("button", {
        name: "Operations",
      })
    ).toHaveClass("active");
  });

  it.each(["/landlord/unified-inbox", "/landlord/inbox", "/messages", "/notices"])(
    "marks Communications active while keeping child routes out of the mobile tab bar at %s",
    (path) => {
      renderLandlordNav(path);

      const tabbar = screen.getByRole("navigation", { name: "Bottom navigation" });
      expect(within(tabbar).getByRole("button", { name: "Communications" })).toHaveClass("active");
      expect(within(tabbar).queryByRole("button", { name: "Unified Inbox" })).not.toBeInTheDocument();
      expect(within(tabbar).queryByRole("button", { name: "Messages" })).not.toBeInTheDocument();
      expect(within(tabbar).queryByRole("button", { name: "Notices" })).not.toBeInTheDocument();
    }
  );

  it.each([
    ["/landlord/unified-inbox", "Unified Inbox"],
    ["/messages", "Messages"],
    ["/notices", "Notices"],
  ])("keeps route-specific titles and active Communications menu items for %s", (path, label) => {
    renderLandlordNav(path);

    const context = screen.getByLabelText("Workspace context");
    const workspaceNav = screen.getByRole("navigation", { name: "Workspace navigation" });
    fireEvent.click(
      within(document.querySelector(".rc-landlord-mobile-topbar") as HTMLElement).getByRole("button", {
        name: "Communications",
      })
    );
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
    fireEvent.click(
      within(document.querySelector(".rc-landlord-mobile-topbar") as HTMLElement).getByRole("button", {
        name: "Communications",
      })
    );
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

  it("keeps the active communication route out of the responsive drawer", () => {
    renderLandlordNav("/notices");

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    const drawer = within(screen.getByRole("dialog", { name: "Navigation menu" }));
    expect(drawer.queryByRole("group", { name: "Communications" })).not.toBeInTheDocument();
    expect(drawer.queryByRole("button", { name: "Notices" })).not.toBeInTheDocument();
    expect(drawer.queryByRole("button", { name: "Messages" })).not.toBeInTheDocument();
    expect(drawer.queryByRole("button", { name: "Unified Inbox" })).not.toBeInTheDocument();
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
