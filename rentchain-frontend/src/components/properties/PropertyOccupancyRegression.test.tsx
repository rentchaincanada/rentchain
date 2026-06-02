import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyDetailPanel } from "./PropertyDetailPanel";

import {
  buildLifecycleContinuityLease,
  buildLifecycleContinuityProperty,
  buildLifecycleContinuityTenant,
  buildLifecycleContinuityUnits,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
  lifecycleContinuityLabels,
} from "../../test/fixtures/lifecycleContinuityFixtures";

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
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

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
  resolveRequiredPlanLabel: () => "Starter",
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

function centsToDollars(value: unknown): number | undefined {
  return typeof value === "number" ? value / 100 : undefined;
}

function fixtureUnit(unitId: string, overrides: Record<string, unknown> = {}) {
  const source = buildLifecycleContinuityUnits().find((unit) => unit.id === unitId);
  return {
    ...source,
    rent: centsToDollars(source?.configuredRentCents),
    ...overrides,
  };
}

function fixtureLease(kind: "active" | "upcoming" | "archived", overrides: Record<string, unknown> = {}) {
  const source = buildLifecycleContinuityLease(kind);
  const deterministicDates =
    kind === "active"
      ? { startDate: "2020-06-01", endDate: "2099-05-31" }
      : kind === "upcoming"
      ? { startDate: "2099-07-01", endDate: "2100-06-30" }
      : { startDate: "2020-06-01", endDate: "2021-05-31" };
  return {
    ...source,
    ...deterministicDates,
    monthlyRent: centsToDollars(source.rentCents),
    tenantName:
      kind === "active"
        ? lifecycleContinuityLabels.activeTenantName
        : kind === "upcoming"
        ? lifecycleContinuityLabels.upcomingTenantName
        : lifecycleContinuityLabels.archivedTenantName,
    signatureStatus: source.signingStatus,
    ...overrides,
  };
}

function propertyFixture() {
  const property = buildLifecycleContinuityProperty();
  return {
    id: property.id,
    name: property.name,
    addressLine1: "10 Harbour Road",
    city: "Halifax",
    province: "NS",
    postalCode: "B3H 1A1",
    country: "Canada",
    totalUnits: 3,
    amenities: [],
    units: [],
    createdAt: lifecycleContinuityDates.now,
  };
}

function renderPropertyDetail() {
  render(
    <MemoryRouter>
      <PropertyDetailPanel property={propertyFixture() as any} onRefresh={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("PropertyDetailPanel occupancy regression coverage", () => {
  beforeEach(() => {
    mocks.updateProperty.mockResolvedValue({ property: { id: lifecycleContinuityIds.propertyId } });
    mocks.archiveProperty.mockResolvedValue({ property: { id: lifecycleContinuityIds.propertyId, portfolioStatus: "archived" } });
    mocks.getPropertyMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });
    mocks.fetchUnitsForProperty.mockResolvedValue([
      fixtureUnit(lifecycleContinuityIds.unit101Id),
      fixtureUnit(lifecycleContinuityIds.unit102Id),
      fixtureUnit(lifecycleContinuityIds.unit103Id),
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        fixtureLease("active"),
        fixtureLease("upcoming"),
        fixtureLease("archived"),
      ],
      credibilitySummary: null,
    });
    mocks.showToast.mockReset();
    mocks.dispatchUpgradePrompt.mockReset();
    mocks.navigate.mockReset();
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

  afterEach(() => {
    cleanup();
  });

  it("renders occupied, upcoming, and vacant unit states from lifecycle fixture leases", async () => {
    renderPropertyDetail();

    expect((await screen.findAllByText("Occupied")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vacant").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "John Smith" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ends May 31, 2099/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Bailey Blinkers" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ends Jun 30, 2100/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Casey Past · Ends May 31, 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(lifecycleContinuityIds.activeLeaseId)).not.toBeInTheDocument();
    expect(screen.queryByText(lifecycleContinuityIds.unit101Id)).not.toBeInTheDocument();
  });

  it("does not let archived leases mark units occupied when no current lease exists", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([
      fixtureUnit(lifecycleContinuityIds.unit101Id, {
        tenantId: lifecycleContinuityIds.archivedTenantId,
        activeLeaseId: lifecycleContinuityIds.archivedLeaseId,
      }),
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [fixtureLease("archived")],
      credibilitySummary: null,
    });

    renderPropertyDetail();

    expect((await screen.findAllByText("Archived")).length).toBeGreaterThan(0);
    expect(screen.queryByText(lifecycleContinuityLabels.activeTenantName)).not.toBeInTheDocument();
    expect(screen.queryByText(/John Smith · Ends/)).not.toBeInTheDocument();
  });

  it("surfaces review-needed conflicts instead of forcing occupied or vacant", async () => {
    mocks.fetchUnitsForProperty.mockResolvedValue([fixtureUnit(lifecycleContinuityIds.unit102Id)]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        fixtureLease("active", {
          id: "lc_conflict_lease_a",
          unitId: lifecycleContinuityIds.unit102Id,
          unitNumber: "102",
          tenantId: lifecycleContinuityIds.activeTenantId,
          tenantName: lifecycleContinuityLabels.activeTenantName,
        }),
        fixtureLease("active", {
          id: "lc_conflict_lease_b",
          unitId: lifecycleContinuityIds.unit102Id,
          unitNumber: "102",
          tenantId: lifecycleContinuityIds.upcomingTenantId,
          tenantName: lifecycleContinuityLabels.upcomingTenantName,
        }),
      ],
      credibilitySummary: null,
    });

    renderPropertyDetail();

    expect((await screen.findAllByText("Review needed")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Multiple current leases match this unit.").length).toBeGreaterThan(0);
  });

  it("hydrates edit modal from the same normalized occupancy source as the unit table", async () => {
    const staleTenant = buildLifecycleContinuityTenant("archived").fullName;
    mocks.fetchUnitsForProperty.mockResolvedValue([
      fixtureUnit(lifecycleContinuityIds.unit101Id, {
        status: "occupied",
        occupantName: staleTenant,
        leaseEndDate: "2026-08-30",
      }),
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [fixtureLease("active")],
      credibilitySummary: null,
    });

    renderPropertyDetail();

    await waitFor(() => expect(screen.getAllByRole("link", { name: "John Smith" }).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Ends May 31, 2099/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);

    expect(screen.getByTestId("unit-edit-modal")).toBeInTheDocument();
    expect(screen.getByText("modal tenant: John Smith")).toBeInTheDocument();
    expect(screen.getByText("modal lease end: 2099-05-31")).toBeInTheDocument();
    expect(screen.queryByText(`modal tenant: ${staleTenant}`)).not.toBeInTheDocument();
  });

  it("keeps lease risk rent aligned with canonical unit rent and avoids raw unit ids as labels", async () => {
    const rawUnitId = "wzECCdkACeLm2yWdV9b3";
    mocks.fetchUnitsForProperty.mockResolvedValue([
      fixtureUnit(lifecycleContinuityIds.unit102Id, {
        id: rawUnitId,
        unitId: rawUnitId,
        unitNumber: "102",
        rent: 1540,
      }),
    ]);
    mocks.getLeasesForProperty.mockResolvedValue({
      leases: [
        fixtureLease("active", {
          id: "lc_lease_unit_102",
          unitId: rawUnitId,
          unitNumber: rawUnitId,
          tenantId: lifecycleContinuityIds.activeTenantId,
          tenantName: lifecycleContinuityLabels.activeTenantName,
          monthlyRent: 1400,
          riskScore: 72,
          riskGrade: "B",
        }),
      ],
      credibilitySummary: null,
    });

    renderPropertyDetail();

    expect((await screen.findAllByText("Lease risk overview")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unit 102").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,540 / month").length).toBeGreaterThan(0);
    expect(screen.queryByText("$1,400 / month")).not.toBeInTheDocument();
    expect(screen.queryByText(`Unit ${rawUnitId}`)).not.toBeInTheDocument();
  });

  it("keeps canonical ledger navigation on lease-backed occupancy rows", async () => {
    renderPropertyDetail();

    const ledgerLinks = await screen.findAllByRole("link", { name: "Ledger" });
    expect(ledgerLinks.some((link) => link.getAttribute("href") === `/leases/${lifecycleContinuityIds.activeLeaseId}/ledger`)).toBe(true);
    expect(ledgerLinks.some((link) => link.getAttribute("href") === `/leases/${lifecycleContinuityIds.upcomingLeaseId}/ledger`)).toBe(true);

    const activeRow = screen.getAllByRole("link", { name: "John Smith" })[0].closest("td");
    expect(activeRow).toBeTruthy();
    expect(within(activeRow as HTMLElement).getByRole("link", { name: "Ledger" })).toHaveAttribute(
      "href",
      `/leases/${lifecycleContinuityIds.activeLeaseId}/ledger`,
    );
  });
});
