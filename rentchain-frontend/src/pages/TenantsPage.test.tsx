import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantsPage } from "./TenantsPage";

type ResponsiveMasterDetailProps = {
  master: ReactNode;
  detail: ReactNode;
  searchSlot?: ReactNode;
};

type InviteTenantModalProps = {
  open: boolean;
  defaultTenantEmail?: string;
  defaultTenantName?: string;
  defaultPropertyId?: string;
  defaultUnitId?: string;
};

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useToastMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  fetchTenantsMock: vi.fn(),
  fetchTenantTenanciesMock: vi.fn(),
  updateTenantRecordMock: vi.fn(),
  updateTenancyMock: vi.fn(),
  useTenantDetailMock: vi.fn(),
  createTenantEventMock: vi.fn(),
  hydrateTenantSummariesBatchMock: vi.fn(),
  getCachedTenantSummaryMock: vi.fn(),
  openUpgradeFlowMock: vi.fn(),
  trackMock: vi.fn(),
  inviteTenantModalMock: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: mocks.useToastMock,
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("@/api/tenantsApi", () => ({
  fetchTenants: mocks.fetchTenantsMock,
  fetchTenantTenancies: mocks.fetchTenantTenanciesMock,
  updateTenantRecord: mocks.updateTenantRecordMock,
  updateTenancy: mocks.updateTenancyMock,
}));

vi.mock("@/hooks/useTenantDetail", () => ({
  useTenantDetail: mocks.useTenantDetailMock,
}));

vi.mock("@/api/tenantEventsWriteApi", () => ({
  createTenantEvent: mocks.createTenantEventMock,
}));

vi.mock("../components/tenants/TenantDetailPanel", () => ({
  TenantDetailPanel: () => <div>Tenant detail</div>,
}));

vi.mock("../components/tenants/TenantLeasePanel", () => ({
  TenantLeasePanel: () => <div>Tenant lease</div>,
}));

vi.mock("../components/tenants/TenantPaymentsPanel", () => ({
  TenantPaymentsPanel: () => <div>Tenant payments</div>,
}));

vi.mock("../components/layout/ResponsiveMasterDetail", () => ({
  ResponsiveMasterDetail: ({ master, detail, searchSlot }: ResponsiveMasterDetailProps) => (
    <div>
      {searchSlot}
      {master}
      {detail}
    </div>
  ),
}));

vi.mock("../components/tenants/InviteTenantModal", () => ({
  InviteTenantModal: (props: InviteTenantModalProps) => {
    mocks.inviteTenantModalMock(props);
    return props.open ? <div>Invite modal open</div> : null;
  },
}));

vi.mock("../components/tenant/TenantScorePill", () => ({
  TenantScorePill: () => <div>Score</div>,
}));

vi.mock("../lib/tenantSummaryCache", () => ({
  hydrateTenantSummariesBatch: mocks.hydrateTenantSummariesBatchMock,
  getCachedTenantSummary: mocks.getCachedTenantSummaryMock,
}));

vi.mock("../lib/analytics", () => ({
  track: mocks.trackMock,
}));

vi.mock("@/billing/openUpgradeFlow", () => ({
  openUpgradeFlow: mocks.openUpgradeFlowMock,
}));

describe("TenantsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", role: "landlord" },
      ready: true,
      isLoading: false,
      authStatus: "ready",
    });
    mocks.useToastMock.mockReturnValue({ showToast: vi.fn() });
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: false },
    });
    mocks.fetchTenantsMock.mockResolvedValue([]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);
    mocks.updateTenantRecordMock.mockResolvedValue({});
    mocks.updateTenancyMock.mockResolvedValue({});
    mocks.useTenantDetailMock.mockReturnValue({ bundle: null, loading: false, error: null });
    mocks.createTenantEventMock.mockResolvedValue({ ok: true });
    mocks.hydrateTenantSummariesBatchMock.mockResolvedValue(undefined);
    mocks.getCachedTenantSummaryMock.mockReturnValue(null);
    mocks.openUpgradeFlowMock.mockResolvedValue(true);
    mocks.trackMock.mockReset();
    mocks.inviteTenantModalMock.mockReset();
  });

  it("uses the working upgrade flow for locked tenant invites", async () => {
    render(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Unlock Tenant Invites" }));

    expect(mocks.openUpgradeFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackPath: "/pricing" })
    );
  });

  it("shows a tenant action hub with edit, note, and invite actions", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        propertyName: "Main Street",
        propertyId: "property-1",
        unit: "Unit 4",
        unitId: "unit-4",
        currentLeaseId: "lease-1",
        lifecycle: {
          lifecycleState: "active",
          lifecycleLabel: "Active",
          lifecycleReason: "active_tenancy_or_lease_signal",
          confidence: "high",
          sourceFields: { leaseStatus: "active" },
          flags: {
            hasActiveLease: true,
            hasPendingLease: false,
            hasCompletedScreening: false,
            isArchived: false,
            isPastTenant: false,
            hasStateConflict: false,
          },
        },
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-1", tenantId: "tenant-1", status: "active", unitLabel: "Unit 4" },
    ]);

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit tenant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send tenant invite" })).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    const leaseLinks = screen.getAllByRole("link", { name: "Main Street · Unit 4 · Lease" });
    expect(leaseLinks.length).toBeGreaterThan(0);
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-1/summary");
    expect(screen.queryByText("lease-1")).not.toBeInTheDocument();
    expect(screen.getByText("Lease ledger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View ledger" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export ledger" })).toBeEnabled();
  });

  it("shows the current lease from tenant detail when the list row has no currentLeaseId", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        propertyName: "Main Street",
        propertyId: "property-1",
        unit: "Unit 4",
        unitId: "unit-4",
        currentLeaseId: null,
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-1", tenantId: "tenant-1", status: "active", unitLabel: "Unit 4" },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        currentLease: {
          id: "lease-active-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          propertyName: "Main Street",
          unitId: "unit-4",
          unit: "Unit 4",
          leaseStart: "2026-01-01",
          leaseEnd: null,
          monthlyRent: 1850,
          status: "active",
        },
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant actions")).toBeInTheDocument();
    const leaseLinks = screen.getAllByRole("link", { name: "Main Street · Unit 4 · Lease" });
    expect(leaseLinks.length).toBeGreaterThan(0);
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-active-1/summary");
    expect(screen.queryByText("lease-active-1")).not.toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
  });

  it("shows no current lease linked when neither list nor detail has a current lease", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        propertyName: "Main Street",
        propertyId: "property-1",
        unit: "Unit 4",
        unitId: "unit-4",
        currentLeaseId: null,
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-1", tenantId: "tenant-1", status: "active", unitLabel: "Unit 4" },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        currentLease: null,
        lease: null,
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant actions")).toBeInTheDocument();
    expect(screen.getAllByText("No current lease linked").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "View ledger" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export ledger" })).toBeDisabled();
    expect(screen.getByText("Link a current lease before using lease ledger actions.")).toBeInTheDocument();
  });

  it("fails closed by hiding the targeted cleanup tenant ids from the landlord list", async () => {
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "c43992df00d07acae140ba76",
        fullName: "test2",
        email: "hello+tenanttest2@rentchain.ai",
      },
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Taylor Tenant")).toBeInTheDocument();
    expect(screen.queryByText("test2")).not.toBeInTheDocument();
  });

  it("prefills the invite modal from the selected tenant profile", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        propertyId: "property-1",
        unitId: "unit-4",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Send tenant invite" }));

    expect(await screen.findByText("Invite modal open")).toBeInTheDocument();
    const lastInviteCall = mocks.inviteTenantModalMock.mock.calls.at(-1)?.[0];
    expect(lastInviteCall).toEqual(
      expect.objectContaining({
        defaultTenantEmail: "tenant@example.com",
        defaultTenantName: "Taylor Tenant",
        defaultPropertyId: "property-1",
        defaultUnitId: "unit-4",
      })
    );
  });

  it("saves tenant profile edits through the landlord-safe patch path", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "9025550000",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);
    mocks.updateTenantRecordMock.mockResolvedValue({
      id: "tenant-1",
      fullName: "Taylor Tenant Updated",
      email: "updated@example.com",
      phone: "9025551111",
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit tenant" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Taylor Tenant Updated" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "updated@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "(902) 555-1111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save tenant" }));

    expect(mocks.updateTenantRecordMock).toHaveBeenCalledWith("tenant-1", {
      fullName: "Taylor Tenant Updated",
      email: "updated@example.com",
      phone: "9025551111",
    });
  });

  it("records tenant notes through the audited tenant-events path", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add note" }));
    fireEvent.change(screen.getByPlaceholderText("Add a note about contact details, follow-up, or context."), {
      target: { value: "Confirmed unit details by phone." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(mocks.createTenantEventMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      type: "NOTE_ADDED",
      description: "Confirmed unit details by phone.",
    });
  });

  it("filters hidden tenants from the active landlord list even if they are returned by the API", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { tenant_invites: true },
    });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-hidden",
        fullName: "Hidden Test Tenant",
        hiddenFromActiveLists: true,
      },
      {
        id: "tenant-visible",
        fullName: "Visible Tenant",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Visible Tenant")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Test Tenant")).not.toBeInTheDocument();
  });
});
