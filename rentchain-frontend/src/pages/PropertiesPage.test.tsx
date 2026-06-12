import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropertiesPage from "./PropertiesPage";

const mocks = vi.hoisted(() => ({
  fetchPropertiesMock: vi.fn(),
  fetchCountsMock: vi.fn(),
  addUnitsManualMock: vi.fn(),
  showToastMock: vi.fn(),
  useToastMock: vi.fn(),
  useAuthMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  printSummaryDocumentMock: vi.fn(),
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../components/layout/MacShell", () => ({
  MacShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../components/properties/AddPropertyForm", () => ({
  AddPropertyForm: ({ onCreated }: any) => (
    <div>
      <div>Add form</div>
      {onCreated ? (
        <button
          type="button"
          onClick={() =>
            onCreated({
              id: "prop-created",
              name: "Created Property",
              portfolioStatus: "active",
            })
          }
        >
          Complete property setup
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../components/property/PropertyActivityPanel", () => ({
  PropertyActivityPanel: () => <div>Activity</div>,
}));

vi.mock("../components/properties/PropertyDetailPanel", () => ({
  PropertyDetailPanel: ({ property }: any) => (
    <div>
      <div>Detail</div>
      {(property?.units || []).map((unit: any) => (
        <div key={String(unit?.id || unit?.unitNumber)}>{`${unit?.id}:${unit?.unitNumber}`}</div>
      ))}
    </div>
  ),
}));

vi.mock("../components/properties/PropertySelector", () => ({
  PropertySelector: () => <div>Selector</div>,
}));

vi.mock("../components/billing/UpgradeCTA", () => ({
  UpgradeCTA: ({ label }: { label?: string }) => <button type="button">{label || "Upgrade"}</button>,
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
  addUnitsManual: mocks.addUnitsManualMock,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: mocks.useToastMock,
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../utils/printSummary", () => ({
  printSummaryDocument: mocks.printSummaryDocumentMock,
}));

vi.mock("../lib/analytics", () => ({
  track: vi.fn(),
}));

describe("PropertiesPage", () => {
  beforeEach(() => {
    mocks.fetchPropertiesMock.mockReset();
    mocks.fetchCountsMock.mockReset();
    mocks.addUnitsManualMock.mockReset();
    mocks.showToastMock.mockReset();
    mocks.useToastMock.mockReset();
    mocks.useAuthMock.mockReset();
    mocks.useCapabilitiesMock.mockReset();
    mocks.printSummaryDocumentMock.mockReset();
    mocks.fetchPropertiesMock.mockImplementation(async (filters?: any) => ({
      items:
        filters?.status === "archived"
          ? [{ id: "prop-2", name: "Archived Property", portfolioStatus: "archived" }]
          : [{ id: "prop-1", name: "Active Property", portfolioStatus: "active" }],
    }));
    mocks.fetchCountsMock.mockResolvedValue({ counts: {} });
    mocks.addUnitsManualMock.mockResolvedValue({
      ok: true,
      created: 1,
      units: [{ id: "unit-created-1", unitNumber: "101", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" }],
    });
    mocks.useToastMock.mockReturnValue({ showToast: mocks.showToastMock });
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", plan: "free", role: "landlord" },
    });
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: { tenant_invites: false },
      loading: false,
    });
    mocks.printSummaryDocumentMock.mockResolvedValue(undefined);
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

  it("shows free tier labels and upgrade guidance in the property overview", async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Free tier property workflow")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Free tier supports manual applicant intake and basic property management. Starter adds batch application invitations, screening workflow tools, and tenant portals."
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Active Property").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free tier").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Upgrade to Starter" }).length).toBeGreaterThan(0);
  });

  it("shows a print action when a property is selected", async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Print / Save PDF" }).length).toBeGreaterThan(0);
    });
  });

  it("routes property print through the shared summary print helper", async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Print / Save PDF" }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Print / Save PDF" })[0]);

    expect(mocks.printSummaryDocumentMock).toHaveBeenCalledWith("summary");
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

  it("shows a free-safe next step after property creation", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);

    expect(await screen.findByText("Your first property is set up")).toBeInTheDocument();
    expect(screen.getByText("Step 1 complete")).toBeInTheDocument();
    expect(screen.getByText("Step 2 next")).toBeInTheDocument();
    expect(screen.getByText("Add your first unit")).toBeInTheDocument();
    expect(screen.getByText("Step 3 later")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a unit" })).toBeInTheDocument();
    expect(screen.getByText("Move into the application workflow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send application" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite a tenant" })).not.toBeInTheDocument();
  });

  it("keeps the later step free-safe when tenant invite capability is missing from features", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: {},
      loading: false,
    });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);

    expect(await screen.findByText("Move into the application workflow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send application" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite a tenant" })).not.toBeInTheDocument();
  });

  it("stores created units with persisted IDs from the save response", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.addUnitsManualMock).toHaveBeenCalledWith(
        "prop-created",
        expect.arrayContaining([expect.objectContaining({ unitNumber: "101" })])
      );
    });
    expect(await screen.findByText("unit-created-1:101")).toBeInTheDocument();
  });

  it("keeps the unit modal open when created unit IDs are unresolved", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });
    mocks.addUnitsManualMock.mockResolvedValue({ ok: true, created: 1 });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to save units",
          description: expect.stringContaining("stable IDs"),
          variant: "error",
        })
      );
    });
    expect(screen.getByText("Add Units")).toBeInTheDocument();
  });
});
