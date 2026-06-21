import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ActionCenterDrawer } from "./ActionCenterDrawer";

const mocks = vi.hoisted(() => ({
  fetchActionCenterMock: vi.fn(),
}));

vi.mock("../../api/actionCenterApi", () => ({
  fetchActionCenter: mocks.fetchActionCenterMock,
}));

describe("ActionCenterDrawer", () => {
  it("uses shell-aware overlay classes so the drawer does not sit under the workspace bar", async () => {
    mocks.fetchActionCenterMock.mockResolvedValue({ actionRequests: [] });

    render(
      <MemoryRouter>
        <ActionCenterDrawer open onClose={vi.fn()} propertyLabelById={{}} />
      </MemoryRouter>
    );

    const drawer = await screen.findByText("Action Center");
    const drawerShell = drawer.closest(".rc-action-center-drawer");
    const backdrop = document.querySelector(".rc-action-center-backdrop");

    expect(drawerShell).toBeInTheDocument();
    expect(drawerShell).toHaveClass("rc-safe-drawer");
    expect(backdrop).toBeInTheDocument();
  });
});
