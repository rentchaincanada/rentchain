import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyDetailPanel } from "./PropertyDetailPanel";

const mocks = vi.hoisted(() => ({
  updateProperty: vi.fn(),
  archiveProperty: vi.fn(),
  getLeasesForProperty: vi.fn(),
  getPropertyMonthlyPayments: vi.fn(),
  fetchUnitsForProperty: vi.fn(),
  useCapabilities: vi.fn(),
  useEntitlements: vi.fn(),
  showToast: vi.fn(),
  dispatchUpgradePrompt: vi.fn(),
}));

vi.mock("../../api/propertiesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/propertiesApi")>("../../api/propertiesApi");
  return {
    ...actual,
    updateProperty: mocks.updateProperty,
    archiveProperty: mocks.archiveProperty,
    publishProperty: vi.fn(),
    unarchiveProperty: vi.fn(),
  };
});

vi.mock("../../api/leasesApi", () => ({
  getLeasesForProperty: mocks.getLeasesForProperty,
}));

vi.mock("@/api/paymentsApi", () => ({
  getPropertyMonthlyPayments: mocks.getPropertyMonthlyPayments,
}));

vi.mock("../../api/unitsImportApi", () => ({
  importUnitsCsv: vi.fn(),
  previewPropertyUnitsCsv: vi.fn(),
}));

vi.mock("../../api/unitsApi", () => ({
  fetchUnitsForProperty: mocks.fetchUnitsForProperty,
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: () => mocks.useCapabilities(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => mocks.useEntitlements(),
}));

vi.mock("@/lib/upgradePrompt", () => ({
  dispatchUpgradePrompt: (...args: any[]) => mocks.dispatchUpgradePrompt(...args),
  resolveRequiredPlanLabel: (featureKey: string, currentPlan: string) => {
    if (featureKey === "applications" && currentPlan === "free") return "Starter";
    if (featureKey === "units" && currentPlan === "free") return "Starter";
    return "Starter";
  },
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({ openUpgrade: vi.fn() }),
}));

vi.mock("@/components/properties/PropertyRegistryStatusCard", () => ({
  PropertyRegistryStatusCard: () => null,
}));

vi.mock("@/components/properties/HalifaxRegistrySubmissionAssistant", () => ({
  HalifaxRegistrySubmissionAssistant: () => null,
}));

vi.mock("./UnitsCsvPreviewModal", () => ({
  UnitsCsvPreviewModal: () => null,
}));

vi.mock("./UnitEditModal", () => ({
  UnitEditModal: ({ open, unit }: any) =>
    open ? (
      <div data-testid="unit-edit-modal">
        <div>modal tenant: {unit?.occupantName || ""}</div>
        <div>modal lease end: {unit?.leaseEndDate || ""}</div>
      </div>
    ) : null,
}));

vi.mock("./SendApplicationModal", () => ({
  SendApplicationModal: () => null,
}));

vi.mock("@/components/leases/RiskScoreBadge", () => ({
  RiskScoreBadge: () => null,
}));

vi.mock("@/components/properties/PropertyCredibilitySummaryCard", () => ({
  PropertyCredibilitySummaryCard: ({ leaseHref }: any) => <a href={leaseHref}>View related leases</a>,
}));

describe("PropertyDetailPanel", () => {
  beforeEach(() => {
    mocks.updateProperty.mockResolvedValue({
      property: { id: "prop-1" },
    });
    mocks.archiveProperty.mockResolvedValue({
      property: { id: "prop-1", portfolioStatus: "archived" },
    });
    mocks.getLeasesForProperty.mockResolvedValue({ leases: [], credibilitySummary: null });
    mocks.getPropertyMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });
    mocks.fetchUnitsForProperty.mockResolvedValue([]);
    mocks.showToast.mockReset();
    mocks.dispatchUpgradePrompt.mockReset();
    mocks.useCapabilities.mockReturnValue({
      caps: { plan: "starter" },
      features: { applications: true, unitsTable: true },
      loading: false,
    });
    mocks.useEntitlements.mockReturnValue({
      plan: "starter",
      hasCapability: (key: string) => key === "applications",
    });
  });

  it("opens a working property edit modal and saves changes", async () => {
    const onRefresh = vi.fn();
    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={onRefresh}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("dialog", { name: "Edit property details" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Property name"), {
      target: { value: "Harbour View Residences" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Compliance & Registry \(Optional\)/i }));
    fireEvent.change(screen.getByLabelText("Property Identifier (PID)"), {
      target: { value: "ns_123-45" },
    });
    fireEvent.change(screen.getByLabelText("Address line 1"), {
      target: { value: "14 Wharf Street" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateProperty).toHaveBeenCalledWith(
        "prop-1",
        expect.objectContaining({
          name: "Harbour View Residences",
          pid: "ns_123-45",
          addressLine1: "14 Wharf Street",
          city: "Halifax",
          province: "NS",
        })
      );
    });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("shows a local upgrade card when the blocked send-application action is clicked on free tier", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-1",
        unitNumber: "101",
        status: "vacant",
      },
    ]);
    mocks.useCapabilities.mockReturnValue({
      caps: { plan: "free" },
      features: { applications: false, unitsTable: true },
      loading: false,
    });
    mocks.useEntitlements.mockReturnValue({
      plan: "free",
      hasCapability: () => false,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    const blockedButtons = await screen.findAllByRole("button", {
      name: /upgrade to starter to send application for unit 101/i,
    });
    fireEvent.click(blockedButtons[0]);

    const upgradeHeadings = await screen.findAllByText("Send application is locked on Free");
    expect(upgradeHeadings.length).toBeGreaterThan(0);

    const upgradeCtas = screen.getAllByRole("button", { name: "See Starter upgrade options" });
    expect(upgradeCtas.length).toBeGreaterThan(0);
    expect(mocks.dispatchUpgradePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "applications",
        source: "property_detail_panel_units",
      })
    );
  });

  it("treats units without active lease records as vacant even when unit flags are stale", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-1",
        unitNumber: "101",
        status: "occupied",
        occupantName: "Jane Tenant",
        rent: 1800,
      },
      {
        id: "unit-2",
        unitNumber: "102",
        status: "vacant",
        rent: 1700,
      },
    ]);

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 2,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Vacant")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Jane Tenant")).not.toBeInTheDocument();
  });

  it("shows manually occupied units when manual occupancy has a current lease end date", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-1",
        unitNumber: "101",
        status: "occupied",
        occupantName: "Leen Bakri-Kasbah and Patricia Emeline Krisinta",
        leaseEndDate: "2027-04-30",
        rent: 1800,
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-expired",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2025-01-01",
          endDate: "2026-04-30",
          status: "active",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Occupied")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  });

  it("renders safely when lease-backed occupancy falls back from active leases", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-1",
        unitNumber: "101",
        rent: 1850,
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          tenantName: "Jane Tenant",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Occupied")).length).toBeGreaterThan(0);
    const tenantLinks = screen.getAllByRole("link", { name: "Jane Tenant" });
    expect(tenantLinks.length).toBeGreaterThan(0);
    expect(tenantLinks[0]).toHaveAttribute("href", "/tenants?tenantId=tenant-1");
    const leaseLinks = screen.getAllByRole("link", { name: "View lease" });
    expect(leaseLinks.length).toBeGreaterThan(0);
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-1/summary");
    expect(screen.queryByText("tenant-1")).not.toBeInTheDocument();
  });

  it("hydrates lease risk unit labels from property units instead of showing raw unit ids", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "wzECCdkACeLm2yWdV9b3",
        unitNumber: "101",
        status: "occupied",
        rent: 1850,
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "wzECCdkACeLm2yWdV9b3",
          unitNumber: "wzECCdkACeLm2yWdV9b3",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          riskScore: 72,
          riskGrade: "B",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Lease risk overview").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Unit 101").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unit wzECCdkACeLm2yWdV9b3")).not.toBeInTheDocument();
  });

  it("uses configured unit rent in lease risk overview when matched unit data is fresher than lease rent", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-102",
        unitNumber: "102",
        status: "occupied",
        rent: 1540,
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-102",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-102",
          unitNumber: "102",
          monthlyRent: 1400,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          riskScore: 72,
          riskGrade: "B",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Lease risk overview").length).toBeGreaterThan(0));
    expect(screen.getAllByText("$1,540 / month").length).toBeGreaterThan(0);
    expect(screen.queryByText("$1,400 / month")).not.toBeInTheDocument();
  });

  it("uses a conservative lease risk fallback when no unit label exists", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "t9Xs0CLL7erK1j3pWQVa",
          unitNumber: "t9Xs0CLL7erK1j3pWQVa",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Assigned unit")).toBeInTheDocument();
    expect(screen.queryByText("Unit t9Xs0CLL7erK1j3pWQVa")).not.toBeInTheDocument();
  });

  it("shows upcoming and notice-period occupancy from lease lifecycle", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-future",
        unitNumber: "201",
        rent: 1800,
      },
      {
        id: "unit-notice",
        unitNumber: "202",
        rent: 1900,
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-future",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-future",
          unitNumber: "201",
          monthlyRent: 1800,
          tenantName: "Future Tenant",
          startDate: "2099-06-01",
          endDate: "2100-05-31",
          status: "active",
          signatureStatus: "signed",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "lease-notice",
          tenantId: "tenant-2",
          propertyId: "prop-1",
          unitId: "unit-notice",
          unitNumber: "202",
          monthlyRent: 1900,
          tenantName: "Current Tenant",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "move_out_pending",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 2,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Upcoming")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Occupied").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Future Tenant" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ends May 31, 2100/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Current Tenant" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ends Dec 31, 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("hydrates the unit edit modal from lease-derived occupancy instead of stale unit fields", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      {
        id: "unit-occupied",
        unitNumber: "101",
        rent: 1800,
        status: "occupied",
        occupantName: "Stale Occupant",
        leaseEndDate: "2026-08-30",
      },
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        {
          id: "lease-occupied",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-occupied",
          unitNumber: "101",
          monthlyRent: 1800,
          tenantName: "John Smith",
          startDate: "2026-01-01",
          endDate: "2027-05-29",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      credibilitySummary: null,
    });

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole("link", { name: "John Smith" }).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Ends May 29, 2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "View related leases" })[0]).toHaveAttribute("href", "/leases?propertyId=prop-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);

    expect(screen.getByText("modal tenant: John Smith")).toBeInTheDocument();
    expect(screen.getByText("modal lease end: 2027-05-29")).toBeInTheDocument();
  });

  it("uses the updated archive confirmation copy before archiving", async () => {
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter>
        <PropertyDetailPanel
          property={{
            id: "prop-1",
            name: "Harbour View",
            addressLine1: "12 Wharf Street",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            country: "Canada",
            totalUnits: 1,
            amenities: [],
            units: [],
            createdAt: new Date().toISOString(),
          }}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: /archive property/i })[0]);

    expect(confirmMock).toHaveBeenCalledWith(
      "Are you sure you want to archive this property? You can reactivate this property later."
    );
    await waitFor(() => expect(mocks.archiveProperty).toHaveBeenCalledWith("prop-1"));
    confirmMock.mockRestore();
  });
});
