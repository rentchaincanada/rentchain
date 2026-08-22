import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantLeasePanel } from "./TenantLeasePanel";

const mocks = vi.hoisted(() => ({
  getLeasesForTenant: vi.fn(),
  getLeaseAutomationTasks: vi.fn(),
  regenerateLeaseAutomationTasks: vi.fn(),
  updateLease: vi.fn(),
  endLease: vi.fn(),
  useCapabilities: vi.fn(),
  openUpgrade: vi.fn(),
}));

vi.mock("../../api/leasesApi", () => ({
  getLeasesForTenant: mocks.getLeasesForTenant,
  getLeaseAutomationTasks: mocks.getLeaseAutomationTasks,
  regenerateLeaseAutomationTasks: mocks.regenerateLeaseAutomationTasks,
  updateLease: mocks.updateLease,
  endLease: mocks.endLease,
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilities,
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({ openUpgrade: mocks.openUpgrade }),
}));

vi.mock("@/components/leases/LeaseRiskCard", () => ({
  LeaseRiskCard: () => <div>Risk card</div>,
}));

describe("TenantLeasePanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCapabilities.mockReturnValue({
      loading: false,
      features: { leases: true },
    });
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyAddress: "123 Harbour St",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          canonicalState: { leaseTermState: "active", occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-1", reasons: [] },
          automationEnabled: true,
        },
      ],
    });
  });

  it("shows the graceful automation unavailable copy when task lookup returns 404", async () => {
    mocks.getLeaseAutomationTasks.mockRejectedValue(new Error("Request failed (404)"));

    render(<TenantLeasePanel tenantId="tenant-1" />);

    expect(await screen.findByText("Automation tasks unavailable")).toBeInTheDocument();
    expect(screen.getByText("We couldn’t load upcoming automation tasks for this lease right now.")).toBeInTheDocument();
    expect(screen.getByText("You can still manage the current lease and ledger normally.")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getLeaseAutomationTasks).toHaveBeenCalledWith("lease-1"));
  });

  it("requires explicit confirmation before ending a lease", async () => {
    mocks.getLeaseAutomationTasks.mockResolvedValue({ tasks: [] });

    render(<TenantLeasePanel tenantId="tenant-1" />);

    expect(await screen.findByText("Property: 123 Harbour St - Unit 101")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "End lease" })[0]);

    expect(mocks.endLease).not.toHaveBeenCalled();
    expect(screen.getByText("End this lease?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This will mark the current lease as ended and update the unit’s occupancy status. This action should only be used when the tenant is no longer occupying the unit."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("End this lease?")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "End lease" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm end lease" }));

    await waitFor(() => expect(mocks.endLease).toHaveBeenCalledWith("lease-1", expect.any(String)));
  });

  it("restores End Lease for the runtime-shaped canonical multi-party response", async () => {
    mocks.getLeaseAutomationTasks.mockResolvedValue({ tasks: [] });
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [
        {
          id: "lease-multi-party",
          tenantId: "tenant-a",
          primaryTenantId: "tenant-a",
          tenantIds: ["tenant-a", "tenant-b"],
          propertyId: "property-1",
          propertyName: "Harbour View",
          unitId: "unit-1",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          occupancyEffective: true,
          canonicalState: {
            leaseTermState: "active",
            occupancyState: "occupied",
            tenantRelationshipState: "current_occupant",
            supportingLeaseId: "lease-multi-party",
            reasons: [],
          },
        },
      ],
    });

    render(<TenantLeasePanel tenantId="tenant-b" />);

    expect(await screen.findByText("Property: Harbour View - Unit 101")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "End lease" })).toHaveLength(1);
  });

  it.each([
    [
      "pending signing",
      {
        id: "lease-pending",
        status: "pending",
        canonicalState: { leaseTermState: "draft", occupancyState: "vacant", tenantRelationshipState: "past_tenant", supportingLeaseId: null, reasons: ["DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"] },
      },
    ],
    [
      "review needed",
      {
        id: "lease-review",
        status: "active",
        canonicalState: { leaseTermState: "active", occupancyState: "review_needed", tenantRelationshipState: "occupancy_unresolved", supportingLeaseId: "lease-review", reasons: ["STALE_CURRENT_LEASE_POINTER"] },
      },
    ],
    [
      "future",
      {
        id: "lease-future",
        status: "active",
        canonicalState: { leaseTermState: "upcoming", occupancyState: "vacant", tenantRelationshipState: "past_tenant", supportingLeaseId: null, reasons: ["UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"] },
      },
    ],
  ])("does not expose End Lease for %s canonical state", async (_label, lease) => {
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [{
        propertyId: "property-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        monthlyRent: 1800,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        ...lease,
      }],
    });

    render(<TenantLeasePanel tenantId="tenant-1" />);
    await waitFor(() => expect(mocks.getLeasesForTenant).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "End lease" })).not.toBeInTheDocument();
  });

  it("fails closed instead of choosing an arbitrary lease when multiple canonical current leases are returned", async () => {
    const canonicalState = {
      leaseTermState: "active",
      occupancyState: "occupied",
      tenantRelationshipState: "current_occupant",
      reasons: [],
    };
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: ["lease-a", "lease-b"].map((id) => ({
        id,
        propertyId: "property-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        monthlyRent: 1800,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        occupancyEffective: true,
        canonicalState: { ...canonicalState, supportingLeaseId: id },
      })),
    });

    render(<TenantLeasePanel tenantId="tenant-1" />);
    await waitFor(() => expect(mocks.getLeasesForTenant).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "End lease" })).not.toBeInTheDocument();
    expect(mocks.getLeaseAutomationTasks).not.toHaveBeenCalled();
  });

  it("does not render raw property ids in lease labels", async () => {
    mocks.getLeaseAutomationTasks.mockResolvedValue({ tasks: [] });
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-raw-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: null,
          status: "active",
          canonicalState: { leaseTermState: "active", occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-1", reasons: [] },
          automationEnabled: true,
        },
        {
          id: "lease-2",
          propertyId: "prop-raw-2",
          propertyLabel: "Property",
          unitNumber: "202",
          monthlyRent: 1600,
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          status: "ended",
        },
      ],
    });

    render(<TenantLeasePanel tenantId="tenant-1" />);

    expect(await screen.findByText("Property: Harbour View - Unit 101")).toBeInTheDocument();
    expect(screen.getByText("Property - Unit 202")).toBeInTheDocument();
    expect(screen.queryByText(/prop-raw-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prop-raw-2/i)).not.toBeInTheDocument();
  });

  it("formats lease date-only values without shifting to the previous day", async () => {
    mocks.getLeaseAutomationTasks.mockResolvedValue({ tasks: [] });
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-05-01",
          endDate: "2026-06-01",
          status: "active",
          automationEnabled: true,
        },
      ],
    });

    render(<TenantLeasePanel tenantId="tenant-1" />);

    expect(await screen.findByText(/May 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Apr 30, 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/May 31, 2026/)).not.toBeInTheDocument();
  });

  it("surfaces a signed future lease as upcoming instead of showing no current lease", async () => {
    mocks.getLeaseAutomationTasks.mockResolvedValue({ tasks: [] });
    mocks.getLeasesForTenant.mockResolvedValue({
      leases: [
        {
          id: "lease-future",
          propertyId: "prop-1",
          propertyName: "North Towers",
          unitNumber: "103",
          monthlyRent: 1640,
          startDate: "2099-07-01",
          endDate: "2100-06-30",
          status: "active",
          signatureStatus: "signed",
          automationEnabled: true,
        },
      ],
    });

    render(<TenantLeasePanel tenantId="tenant-1" />);

    expect(await screen.findByText("Upcoming Lease")).toBeInTheDocument();
    expect(screen.getByText("Property: North Towers - Unit 103")).toBeInTheDocument();
    expect(mocks.getLeaseAutomationTasks).not.toHaveBeenCalled();
  });
});
