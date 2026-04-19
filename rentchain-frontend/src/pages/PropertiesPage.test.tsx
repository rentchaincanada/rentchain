import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropertiesPage from "./PropertiesPage";

const mocks = vi.hoisted(() => ({
  fetchPropertiesMock: vi.fn(),
  fetchCountsMock: vi.fn(),
  useToastMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../components/layout/MacShell", () => ({
  MacShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../components/properties/AddPropertyForm", () => ({
  AddPropertyForm: () => <div>Add form</div>,
}));

vi.mock("../components/property/PropertyActivityPanel", () => ({
  PropertyActivityPanel: () => <div>Activity</div>,
}));

vi.mock("../components/properties/PropertyDetailPanel", () => ({
  PropertyDetailPanel: () => <div>Detail</div>,
}));

vi.mock("../components/properties/PropertySelector", () => ({
  PropertySelector: () => <div>Selector</div>,
}));

vi.mock("../components/ActionRequestsPanel", () => ({
  ActionRequestsPanel: () => <div>Actions</div>,
}));

vi.mock("../components/action-center/ActionCenterDrawer", () => ({
  ActionCenterDrawer: () => null,
}));

vi.mock("../components/leases/LeasePackGeneratorModal", () => ({
  LeasePackGeneratorModal: () => null,
}));

vi.mock("../api/actionRequestCountsApi", () => ({
  fetchActionRequestCounts: mocks.fetchCountsMock,
}));

vi.mock("../api/actionRequestsApi", () => ({
  listActionRequests: vi.fn().mockResolvedValue([]),
  acknowledgeActionRequest: vi.fn(),
  resolveActionRequest: vi.fn(),
}));

vi.mock("../api/actionSnapshotApi", () => ({
  fetchMonthlyOpsSnapshot: vi.fn().mockResolvedValue({ properties: {} }),
}));

vi.mock("../api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

vi.mock("../api/unitsApi", () => ({
  addUnitsManual: vi.fn(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: mocks.useToastMock,
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../lib/analytics", () => ({
  track: vi.fn(),
}));

describe("PropertiesPage", () => {
  beforeEach(() => {
    mocks.fetchPropertiesMock.mockImplementation(async (filters?: any) => ({
      items:
        filters?.status === "archived"
          ? [{ id: "prop-2", name: "Archived Property", portfolioStatus: "archived" }]
          : [{ id: "prop-1", name: "Active Property", portfolioStatus: "active" }],
    }));
    mocks.fetchCountsMock.mockResolvedValue({ counts: {} });
    mocks.useToastMock.mockReturnValue({ showToast: vi.fn() });
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", plan: "free", role: "landlord" },
    });
  });

  it("renders active and archived property filters", async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchPropertiesMock).toHaveBeenCalledWith({ status: "active" });
    });

    fireEvent.click(screen.getByRole("button", { name: "Archived properties" }));

    await waitFor(() => {
      expect(mocks.fetchPropertiesMock).toHaveBeenCalledWith({ status: "archived" });
    });

    expect(screen.getByText("Archived properties are hidden from active portfolio views but preserved for records and history.")).toBeInTheDocument();
  });

  it("shows a guided first-property empty state for new users", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Start your rental workflow")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first property to begin managing tenants, leases, and maintenance in one place.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your first property" })).toBeInTheDocument();
    expect(screen.getByText("Start here: add your first property")).toBeInTheDocument();
  });
});
