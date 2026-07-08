import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { WORKSPACE_DRAWER_MOBILE_QUERY, WorkspaceDrawer } from "./WorkspaceDrawer";

const mocks = vi.hoisted(() => ({
  useCapabilities: vi.fn(),
  useIsMobile: vi.fn(),
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilities,
}));

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: mocks.useIsMobile,
}));

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

describe("WorkspaceDrawer", () => {
  beforeEach(() => {
    mocks.useCapabilities.mockReturnValue({
      features: { messaging: true, maintenance: true, portfolio_health_summary: true },
      loading: false,
    });
    mocks.useIsMobile.mockReturnValue(true);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("navigates when a drawer option is selected", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <WorkspaceDrawer open onClose={onClose} userRole="landlord" userEmail="owner@example.com" />
                <CurrentPath />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Payments" }));

    expect(screen.getByTestId("current-path")).toHaveTextContent("/payments");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows governed review workspace navigation only for admins", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={vi.fn()} userRole="landlord" userEmail="owner@example.com" />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Governed review workspaces" })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={vi.fn()} userRole="admin" userEmail="admin@example.com" />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Governed review workspaces" })).toBeInTheDocument();
  });

  it("uses a bottom-nav-aware sheet on mobile", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={vi.fn()} userRole="landlord" userEmail="owner@example.com" />
      </MemoryRouter>
    );

    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog.parentElement).toHaveStyle({
      bottom: "var(--rc-mobile-drawer-bottom-offset, calc(104px + env(safe-area-inset-bottom, 0px)))",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: "var(--rc-landlord-z-drawer, 4020)",
    });
    expect(dialog).toHaveStyle({
      width: "min(420px, calc(100% - 24px))",
      maxWidth: "min(560px, calc(100% - 24px))",
      height: "auto",
      maxHeight:
        "min(calc(100dvh - var(--rc-mobile-drawer-bottom-offset, calc(104px + env(safe-area-inset-bottom, 0px))) - 16px), 620px)",
      zIndex: "1",
    });
    expect(within(dialog).getByRole("button", { name: "Dashboard" }).parentElement).toHaveStyle({
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    });
  });

  it("uses the same mobile breakpoint as the landlord shell", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={vi.fn()} userRole="landlord" userEmail="owner@example.com" />
      </MemoryRouter>
    );

    expect(mocks.useIsMobile).toHaveBeenCalledWith(WORKSPACE_DRAWER_MOBILE_QUERY);
    expect(WORKSPACE_DRAWER_MOBILE_QUERY).toBe("(max-width: 820px)");
  });

  it("uses a side drawer at reduced desktop widths instead of the bottom sheet", () => {
    mocks.useIsMobile.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={vi.fn()} userRole="landlord" userEmail="owner@example.com" />
      </MemoryRouter>
    );

    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog.parentElement).toHaveStyle({
      bottom: "0",
      alignItems: "flex-start",
      justifyContent: "flex-end",
    });
    expect(dialog).toHaveStyle({
      width: "320px",
      height: "100dvh",
      maxHeight: "100dvh",
      margin: "0",
      borderRadius: "0",
    });
    expect(within(dialog).getByRole("button", { name: "Dashboard" }).parentElement).toHaveStyle({
      gridTemplateColumns: "1fr",
    });
  });

  it("calls close immediately from the close button", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceDrawer open onClose={onClose} userRole="landlord" userEmail="owner@example.com" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
