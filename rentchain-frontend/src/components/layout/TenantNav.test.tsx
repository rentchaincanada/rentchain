import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { TenantNav } from "./TenantNav";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
}));

const tenantCommunicationsApi = vi.hoisted(() => ({
  getTenantCommunicationSummary: vi.fn(),
}));

const logoutTenant = vi.hoisted(() => ({
  logoutTenant: vi.fn(),
}));

vi.mock("../../api/tenantPortal", () => tenantPortalApi);
vi.mock("../../api/tenantCommunicationsApi", () => tenantCommunicationsApi);
vi.mock("../../lib/logoutTenant", () => logoutTenant);

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

function renderTenantNav(initialPath = "/tenant/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <TenantNav>
              <div>Tenant content</div>
              <CurrentPath />
            </TenantNav>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("TenantNav mobile bottom navigation", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        invitedEmail: "tenant@example.com",
      },
      unit: {
        label: "6",
      },
    });
    tenantCommunicationsApi.getTenantCommunicationSummary.mockResolvedValue({
      unreadMessages: 2,
      unreadNotices: 0,
      unreadScreeningUpdates: 0,
    });
  });

  it("renders tenant-safe bottom navigation tabs only", () => {
    renderTenantNav();

    const tabbar = screen.getByRole("navigation", { name: "Tenant bottom navigation" });
    expect(within(tabbar).getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(tabbar).getByRole("button", { name: "Lease" })).toBeInTheDocument();
    expect(within(tabbar).getByRole("button", { name: "Documents" })).toBeInTheDocument();
    expect(within(tabbar).getByRole("button", { name: "Messages" })).toBeInTheDocument();
    expect(within(tabbar).getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(within(tabbar).queryByText("Properties")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Leases")).not.toBeInTheDocument();
    expect(within(tabbar).queryByText("Admin")).not.toBeInTheDocument();
  });

  it("navigates tenant tabs to tenant-safe canonical routes", () => {
    renderTenantNav();

    const tabbar = screen.getByRole("navigation", { name: "Tenant bottom navigation" });
    fireEvent.click(within(tabbar).getByRole("button", { name: "Documents" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tenant/documents");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Lease" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tenant/lease");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Messages" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tenant/messages");

    fireEvent.click(within(tabbar).getByRole("button", { name: "Dashboard" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tenant");
  });

  it("keeps document tab active for the legacy tenant attachments route", () => {
    renderTenantNav("/tenant/attachments");

    const tabbar = screen.getByRole("navigation", { name: "Tenant bottom navigation" });
    expect(within(tabbar).getByRole("button", { name: "Documents" })).toHaveAttribute("aria-current", "page");
  });

  it("opens a tenant-only More menu without landlord or admin routes", () => {
    renderTenantNav();

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    const menu = screen.getByRole("dialog", { name: "Tenant menu" });
    expect(menu).toHaveClass("is-open");
    expect(within(menu).getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Maintenance" })).toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Properties" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("does not render the mobile bottom nav or menu sheet on desktop", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1120 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    renderTenantNav();

    expect(screen.queryByRole("navigation", { name: "Tenant bottom navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Tenant menu" })).not.toBeInTheDocument();
  });

  it("suppresses the More sheet in compact landscape mobile view", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 820 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 390 });

    renderTenantNav();

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.queryByRole("dialog", { name: "Tenant menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-disabled", "true");
  });

  it("adds mobile bottom spacing to tenant content", () => {
    renderTenantNav();

    expect(document.querySelector(".rc-tenant-main")).toBeInTheDocument();
    expect(document.querySelector(".rc-tenant-mobile-tabbar")).toBeInTheDocument();
  });
});
