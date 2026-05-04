import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { WorkspaceDrawer } from "./WorkspaceDrawer";

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
  });

  afterEach(() => {
    cleanup();
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
});
