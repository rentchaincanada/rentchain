import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropertiesPage from "./PropertiesPage";

const mocks = vi.hoisted(() => ({
  fetchPropertiesMock: vi.fn(),
  fetchCountsMock: vi.fn(),
  addUnitsManualMock: vi.fn(),
  patchCreatedUnitOccupancyMetadataMock: vi.fn(),
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
  PropertyDetailPanel: ({ property, onAddUnits }: any) => (
    <div>
      <div>Detail</div>
      <button type="button" data-testid={`property-table-add-units-${property?.id || "none"}`} onClick={onAddUnits}>
        Property table Add units
      </button>
      {(property?.units || []).map((unit: any) => (
        <div key={String(unit?.id || unit?.unitNumber)}>
          {`${unit?.id}:${unit?.unitNumber}:${unit?.beds ?? unit?.bedrooms ?? ""}:${unit?.baths ?? unit?.bathrooms ?? ""}:${unit?.status ?? unit?.occupancyStatus ?? ""}:${unit?.occupantName ?? unit?.tenantName ?? ""}:${unit?.leaseEndDate ?? ""}`}
        </div>
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
  patchCreatedUnitOccupancyMetadata: mocks.patchCreatedUnitOccupancyMetadataMock,
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-route">{`${location.pathname}${location.search}`}</div>;
};

describe("PropertiesPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.fetchPropertiesMock.mockReset();
    mocks.fetchCountsMock.mockReset();
    mocks.addUnitsManualMock.mockReset();
    mocks.patchCreatedUnitOccupancyMetadataMock.mockReset();
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
    mocks.patchCreatedUnitOccupancyMetadataMock.mockImplementation(async (units: any[]) => units);
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

  const openGuidedUnitModal = async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add Property" }));
    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
  };

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
    expect(screen.queryByText("Start here: add your first property")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add your first property" }));

    expect(screen.getByText("Start here: add your first property")).toBeInTheDocument();
  });

  it("keeps the add property form collapsed until requested and supports hiding it", async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchPropertiesMock).toHaveBeenCalledWith({ status: "active" });
    });

    expect(screen.queryByText("Add form")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Property" }));

    expect(screen.getByText("Add a new property")).toBeInTheDocument();
    expect(screen.getByText("Add form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide form" }));

    expect(screen.queryByText("Add form")).not.toBeInTheDocument();
  });

  it("shows a free-safe next step after property creation", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add Property" }));
    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);

    expect(await screen.findByText("Your first property is set up")).toBeInTheDocument();
    expect(screen.queryByText("Add form")).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Add Property" }));
    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);

    expect(await screen.findByText("Move into the application workflow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send application" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite a tenant" })).not.toBeInTheDocument();
  });

  it("stores created units with persisted IDs from the save response", async () => {
    mocks.fetchPropertiesMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [{ id: "prop-created", name: "Created Property", units: [{ id: "unit-created-1", unitNumber: "101" }] }] });

    await openGuidedUnitModal();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.addUnitsManualMock).toHaveBeenCalledWith(
        "prop-created",
        expect.arrayContaining([
          expect.objectContaining({
            unitNumber: "101",
            status: "vacant",
            occupantName: null,
            leaseEndDate: null,
          }),
        ])
      );
    });
    const submitted = mocks.addUnitsManualMock.mock.calls[0][1][0];
    expect(submitted).not.toHaveProperty("id");
    expect(submitted).not.toHaveProperty("unitId");
    expect(submitted).not.toHaveProperty("uid");
    expect(await screen.findByText("unit-created-1:101:1:1:vacant::")).toBeInTheDocument();
  });

  it("submits occupied status and tenant details from the guided unit modal", async () => {
    mocks.fetchPropertiesMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [{ id: "prop-created", name: "Created Property", units: [{ id: "unit-created-1", unitNumber: "202" }] }] });
    mocks.addUnitsManualMock.mockResolvedValue({
      ok: true,
      created: 1,
      units: [
        {
          id: "unit-created-1",
          unitNumber: "202",
          beds: 2,
          baths: 1,
          sqft: 700,
          marketRent: 1800,
          status: "occupied",
          occupantName: "Alice Tenant",
          leaseEndDate: "2027-05-31",
        },
      ],
    });

    await openGuidedUnitModal();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "202" } });
    fireEvent.change(screen.getByLabelText("Beds 1"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Square footage 1"), { target: { value: "700" } });
    fireEvent.change(screen.getByLabelText("Market rent 1"), { target: { value: "1800" } });
    fireEvent.change(screen.getByLabelText("Status 1"), { target: { value: "occupied" } });
    expect(screen.getByLabelText("Status 1")).toHaveValue("occupied");
    fireEvent.change(screen.getByLabelText("Occupant name 1"), { target: { value: "Alice Tenant" } });
    fireEvent.change(screen.getByLabelText("Lease end date 1"), { target: { value: "2027-05-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.addUnitsManualMock).toHaveBeenCalledWith(
        "prop-created",
        [
          expect.objectContaining({
            unitNumber: "202",
            beds: 2,
            sqft: 700,
            marketRent: 1800,
            status: "occupied",
            occupantName: "Alice Tenant",
            tenantName: "Alice Tenant",
            leaseEndDate: "2027-05-31",
          }),
        ]
      );
    });
    await waitFor(() => {
      expect(mocks.patchCreatedUnitOccupancyMetadataMock).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: "unit-created-1",
            unitNumber: "202",
            status: "occupied",
          }),
        ],
        [
          expect.objectContaining({
            status: "occupied",
            occupantName: "Alice Tenant",
            tenantName: "Alice Tenant",
            leaseEndDate: "2027-05-31",
          }),
        ]
      );
    });
  });

  it("keeps the user in property context after guided unit save", async () => {
    mocks.fetchPropertiesMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [{ id: "prop-created", name: "Created Property", units: [{ id: "unit-created-1", unitNumber: "101" }] }] });

    render(
      <MemoryRouter initialEntries={["/properties"]}>
        <LocationProbe />
        <PropertiesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add Property" }));
    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.addUnitsManualMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("current-route")).toHaveTextContent(/^\/properties/);
    expect(screen.getByTestId("current-route")).not.toHaveTextContent("/dashboard");
  });

  it("opens the manual unit modal from the property table add units action and preserves occupied unit metadata", async () => {
    mocks.addUnitsManualMock.mockResolvedValue({
      ok: true,
      created: 1,
      units: [
        {
          id: "unit-created-301",
          unitNumber: "301",
          beds: 2,
          baths: 1.5,
          sqft: 850,
          marketRent: 2100,
          status: "occupied",
          occupantName: "Jane Tenant",
          leaseEndDate: "2027-06-10",
        },
      ],
    });

    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId("property-table-add-units-prop-1"));
    expect(await screen.findByText("Add Units")).toBeInTheDocument();
    expect(screen.getByLabelText("Add units mobile form")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "301" } });
    fireEvent.change(screen.getByLabelText("Beds 1"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Baths 1"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Square footage 1"), { target: { value: "850" } });
    fireEvent.change(screen.getByLabelText("Market rent 1"), { target: { value: "2100" } });
    fireEvent.change(screen.getByLabelText("Status 1"), { target: { value: "occupied" } });
    fireEvent.change(screen.getByLabelText("Occupant name 1"), { target: { value: "Jane Tenant" } });
    fireEvent.change(screen.getByLabelText("Lease end date 1"), { target: { value: "2027-06-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.addUnitsManualMock).toHaveBeenCalledWith(
        "prop-1",
        expect.arrayContaining([
          expect.objectContaining({
            unitNumber: "301",
            beds: 2,
            baths: 1.5,
            status: "occupied",
            occupantName: "Jane Tenant",
            tenantName: "Jane Tenant",
            leaseEndDate: "2027-06-10",
          }),
        ])
      );
    });
    await waitFor(() => {
      expect(mocks.patchCreatedUnitOccupancyMetadataMock).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: "unit-created-301",
            unitNumber: "301",
            status: "occupied",
          }),
        ],
        [
          expect.objectContaining({
            status: "occupied",
            occupantName: "Jane Tenant",
            tenantName: "Jane Tenant",
            leaseEndDate: "2027-06-10",
          }),
        ]
      );
    });
    expect(await screen.findByText("unit-created-301:301:2:1.5:occupied:Jane Tenant:2027-06-10")).toBeInTheDocument();
    expect(mocks.showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unit saved",
        variant: "success",
      })
    );
  });

  it("keeps the guided unit modal open with inline validation when no unit is provided", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });

    await openGuidedUnitModal();

    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    expect(mocks.addUnitsManualMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Add at least one unit number before saving.");
    expect(screen.getByText("Add Units")).toBeInTheDocument();
  });

  it("keeps the unit modal open when created unit IDs are unresolved", async () => {
    mocks.fetchPropertiesMock.mockResolvedValue({ items: [] });
    mocks.addUnitsManualMock.mockResolvedValue({ ok: true, created: 1 });

    await openGuidedUnitModal();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "101" } });
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
