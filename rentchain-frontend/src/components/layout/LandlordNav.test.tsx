import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LandlordNav } from "./LandlordNav";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  fetchLandlordConversations: vi.fn(),
  useCapabilities: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "owner@example.com" },
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

function renderLandlordNav(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <LandlordNav>
              <div data-testid="page-content">Page content</div>
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
      expect(screen.getByRole("dialog", { name: "Navigation menu" })).not.toHaveClass("is-open");
    });
  });

  it("closes the drawer on Escape", async () => {
    renderLandlordNav();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace pages" }));
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toHaveClass("is-open");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Navigation menu" })).not.toHaveClass("is-open");
    });
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
