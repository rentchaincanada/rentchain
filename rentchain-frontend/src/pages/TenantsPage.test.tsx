import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  canInviteOverride?: boolean;
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
    <div className="rc-master-detail rc-master-detail--desktop">
      <div className="rc-master-detail-master">
        {searchSlot}
        {master}
      </div>
      <div className="rc-master-detail-detail">{detail}</div>
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
      user: { id: "user-1", role: "landlord", plan: "starter" },
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

    expect(await screen.findByText("Tenant invites require Starter")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Unlock Tenant Invites" })[0]);

    expect(mocks.openUpgradeFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackPath: "/pricing" })
    );
    expect(mocks.inviteTenantModalMock).not.toHaveBeenCalled();
  });

  it("keeps tenant list and detail in separate desktop scroll regions", async () => {
    mocks.fetchTenantsMock.mockResolvedValue([
      { id: "tenant-1", name: "Tenant One", tenancies: [] },
    ]);

    render(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    );

    const master = await screen.findByText("Tenant One");
    expect(master.closest(".rc-master-detail-master")).toBeInTheDocument();
    expect(document.querySelector(".rc-master-detail-detail")).toBeInTheDocument();
    expect(document.querySelector(".rc-tenants-list-scroll")).toBeInTheDocument();
  });

  it("fails closed when cached invite capability is true but the authenticated plan is free", async () => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", role: "landlord", plan: "free" },
      ready: true,
      isLoading: false,
      authStatus: "ready",
    });
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: { tenant_invites: true },
    });

    render(
      <MemoryRouter>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant invites require Starter")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Unlock Tenant Invites" })[0]);

    expect(mocks.openUpgradeFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackPath: "/pricing" })
    );
    expect(mocks.inviteTenantModalMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Invite modal open")).not.toBeInTheDocument();
  });

  it("blocks locked selected-tenant invite actions before rendering the invite modal", async () => {
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

    expect(await screen.findByText("Tenant invites require Starter")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Unlock Tenant Invites" })[0]);

    expect(mocks.openUpgradeFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackPath: "/pricing" })
    );
    expect(mocks.inviteTenantModalMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Invite modal open")).not.toBeInTheDocument();
  });

  it("does not open the invite modal from a deep link when tenant invites are locked", async () => {
    render(
      <MemoryRouter initialEntries={["/tenants?invite=1&upgradeConfirmed=1&highlight=tenants"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant invites require Starter")).toBeInTheDocument();

    expect(mocks.openUpgradeFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackPath: "/pricing" })
    );
    expect(screen.queryByText("Invite modal open")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Upgrade confirmed. Tenant invites are now unlocked for this workspace.")
    ).not.toBeInTheDocument();
    expect(mocks.inviteTenantModalMock).not.toHaveBeenCalled();
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
    mocks.useTenantDetailMock.mockReturnValue({
      loading: false,
      error: null,
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-1",
          reasons: [],
        },
        currentLease: {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyName: "Main Street",
          unit: "Unit 4",
          status: "active",
        },
        unit: { id: "unit-4", unitNumber: "Unit 4", status: "occupied" },
      },
    });

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
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-1/summary#signed-document");
    expect(screen.queryByText("lease-1")).not.toBeInTheDocument();
    expect(screen.getByText("Payment ledger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open payment ledger" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export payment ledger" })).toBeEnabled();
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
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-active-1",
          reasons: [],
        },
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
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-active-1/summary#signed-document");
    expect(screen.queryByText("lease-active-1")).not.toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open payment ledger" })).toBeEnabled();
  });

  it("does not substitute list canonical state while tenant detail is loading", async () => {
    mocks.fetchTenantsMock.mockResolvedValue([{
      id: "tenant-1",
      fullName: "Taylor Tenant",
      propertyName: "Main Street",
      propertyId: "property-1",
      unit: "Unit 4",
      unitId: "unit-4",
      canonicalState: {
        leaseTermState: "active",
        occupancyState: "occupied",
        tenantRelationshipState: "current_occupant",
        supportingLeaseId: "lease-primary",
        reasons: [],
      },
    }]);
    mocks.useTenantDetailMock.mockReturnValue({ bundle: null, loading: true, error: null });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Loading tenant details…")).toBeInTheDocument();
    expect(screen.getByText("Payment ledger loading with tenant details…")).toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open payment ledger" })).not.toBeInTheDocument();
  });

  it("does not convert a tenant detail error into no-current-lease truth", async () => {
    mocks.fetchTenantsMock.mockResolvedValue([{
      id: "tenant-1",
      fullName: "Taylor Tenant",
      canonicalState: {
        leaseTermState: "active",
        occupancyState: "occupied",
        tenantRelationshipState: "current_occupant",
        supportingLeaseId: "lease-primary",
        reasons: [],
      },
    }]);
    mocks.useTenantDetailMock.mockReturnValue({ bundle: null, loading: false, error: "request failed" });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant details are unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Payment ledger unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open payment ledger" })).not.toBeInTheDocument();
  });

  it("does not use a stale previous tenant detail bundle for the selected tenant", async () => {
    mocks.fetchTenantsMock.mockResolvedValue([{ id: "tenant-b", fullName: "Tenant B" }]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-a", fullName: "Tenant A" },
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-a",
          reasons: [],
        },
        currentLease: { id: "lease-a", tenantId: "tenant-a", status: "active" },
      },
      loading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-b"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Loading tenant details…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Lease/ })).not.toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
  });

  it("keeps signed lease document links inside the lease summary workspace when a lease id is available", async () => {
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
        currentLeaseId: "lease-signed-1",
        status: "active",
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-signed-1",
          reasons: [],
        },
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-1", tenantId: "tenant-1", status: "active", unitLabel: "Unit 4" },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        currentLease: {
          id: "lease-signed-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          propertyName: "Main Street",
          unitId: "unit-4",
          unit: "Unit 4",
          leaseStart: "2026-01-01",
          leaseEnd: null,
          monthlyRent: 1850,
          status: "active",
          signedDocumentUrl: "https://storage.googleapis.com/rentchain-documents-prod/lease-signing/1?X-Goog-Signature=safe",
          signedDocumentExpiresInSeconds: 1800,
          signedDocumentSource: "signedDocument",
        },
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-signed-1",
          reasons: [],
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
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-signed-1/summary#signed-document");
    expect(leaseLinks[0]).not.toHaveAttribute("target", "_blank");
  });

  it("preserves signed-document routing for a coherently identified current lease", async () => {
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
        currentLeaseId: "lease-signed-fallback-1",
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-1", tenantId: "tenant-1", status: "active", unitLabel: "Unit 4" },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        currentLease: {
          id: "lease-signed-fallback-1",
          tenantId: "tenant-1",
          propertyId: "property-1",
          propertyName: "Main Street",
          unitId: "unit-4",
          unit: "Unit 4",
          leaseStart: "2026-01-01",
          leaseEnd: null,
          monthlyRent: 1850,
          status: "active",
          signedDocumentUrl: "https://storage.googleapis.com/rentchain-documents-prod/lease-signing/1?X-Goog-Signature=safe",
          signedDocumentExpiresInSeconds: 1800,
          signedDocumentSource: "signedDocument",
        },
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-signed-fallback-1",
          reasons: [],
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
    expect(leaseLinks[0]).toHaveAttribute("href", "/leases/lease-signed-fallback-1/summary#signed-document");
    expect(leaseLinks[0]).not.toHaveAttribute("target", "_blank");
    expect(document.body).not.toHaveTextContent("X-Goog-Signature");
  });

  it.each([
    {
      label: "an empty-id current lease object with null canonical support",
      supportingLeaseId: null,
      currentLease: { id: "", tenantId: "tenant-1", status: "active" },
    },
    {
      label: "a missing-id current lease object with null canonical support",
      supportingLeaseId: null,
      currentLease: { tenantId: "tenant-1", status: "active" },
    },
    {
      label: "a current lease id that differs from canonical support",
      supportingLeaseId: "lease-a",
      currentLease: { id: "lease-b", tenantId: "tenant-1", status: "active" },
    },
  ])("fails closed for $label", async ({ supportingLeaseId, currentLease }) => {
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        propertyName: "Main Street",
        propertyId: "property-1",
        unit: "Unit 4",
        unitId: "unit-4",
      },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        canonicalState: {
          leaseTermState: supportingLeaseId ? "active" : "none",
          occupancyState: supportingLeaseId ? "occupied" : "vacant",
          tenantRelationshipState: supportingLeaseId ? "current_occupant" : "no_current_occupancy",
          supportingLeaseId,
          reasons: [],
        },
        currentLease,
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-1"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Loading tenant details…")).toBeInTheDocument();
    expect(screen.getByText("Payment ledger loading with tenant details…")).toBeInTheDocument();
    expect(screen.queryByText("No current lease linked")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open payment ledger" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record payment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export payment ledger" })).not.toBeInTheDocument();
  });

  it("uses the current lease as the active unit link when tenancy registration is stale", async () => {
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
        currentLeaseId: "lease-signed-1",
        status: "active",
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-signed-1",
          reasons: [],
        },
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-1", fullName: "Taylor Tenant" },
        currentLease: {
          id: "lease-signed-1",
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
        canonicalState: {
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-signed-1",
          reasons: [],
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
    expect(screen.getAllByText("Current occupant").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(
        "Current lease links this tenant to the active lease and unit; no separate active tenancy registration is recorded yet."
      )
    ).toBeInTheDocument();
    const registeredUnitsCard =
      screen.getByText("Active registered units").closest("section") ||
      screen.getByText("Active registered units").parentElement;
    expect(registeredUnitsCard).not.toBeNull();
    expect(within(registeredUnitsCard as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("No active tenancy registrations are linked to this tenant.")).not.toBeInTheDocument();
  });

  it("uses canonical review state and fails closed on an expired historical lease", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({ features: { tenant_invites: true } });
    mocks.fetchTenantsMock.mockResolvedValue([
      {
        id: "tenant-ref",
        fullName: "Preview QA Expired Tenant",
        propertyName: "PR1555 Canonical QA Property",
        propertyId: "property-1",
        unit: "REF-EXPIRED",
        unitId: "unit-ref",
        currentLeaseId: null,
        status: "active",
        lifecycle: { lifecycleLabel: "Active" },
        canonicalState: {
          leaseTermState: "past",
          occupancyState: "review_needed",
          tenantRelationshipState: "occupancy_unresolved",
          supportingLeaseId: null,
          reasons: ["OCCUPIED_WITHOUT_CURRENT_LEASE"],
        },
      },
    ]);
    mocks.fetchTenantTenanciesMock.mockResolvedValue([
      { id: "tenancy-stale", tenantId: "tenant-ref", status: "active", unitLabel: "REF-EXPIRED" },
    ]);
    mocks.useTenantDetailMock.mockReturnValue({
      bundle: {
        tenant: { id: "tenant-ref", fullName: "Preview QA Expired Tenant", status: "active" },
        currentLease: null,
        lease: {
          id: "lease-ref",
          tenantId: "tenant-ref",
          propertyId: "property-1",
          propertyName: "PR1555 Canonical QA Property",
          unitId: "unit-ref",
          unit: "REF-EXPIRED",
          leaseStart: "2025-05-01",
          leaseEnd: "2026-04-30",
          monthlyRent: 1800,
          status: "active",
        },
        canonicalState: {
          leaseTermState: "past",
          occupancyState: "review_needed",
          tenantRelationshipState: "occupancy_unresolved",
          supportingLeaseId: null,
          reasons: ["OCCUPIED_WITHOUT_CURRENT_LEASE"],
        },
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/tenants?tenantId=tenant-ref"]}>
        <TenantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant actions")).toBeInTheDocument();
    expect(screen.getAllByText("Review needed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("No current lease linked").length).toBeGreaterThanOrEqual(1);
    const registeredUnitsCard = screen.getByText("Active registered units").parentElement;
    expect(registeredUnitsCard).not.toBeNull();
    expect(within(registeredUnitsCard as HTMLElement).getByText("0")).toBeInTheDocument();
    expect(
      screen.getByText("Canonical occupancy requires review; historical property, unit, and lease links are not treated as current.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Current lease links this tenant to the active lease and unit/)).not.toBeInTheDocument();
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
        canonicalState: {
          leaseTermState: "none",
          occupancyState: "vacant",
          tenantRelationshipState: "no_current_occupancy",
          supportingLeaseId: null,
          reasons: [],
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
    expect(screen.getAllByText("No current lease linked").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Open payment ledger" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export payment ledger" })).toBeDisabled();
    expect(screen.getByText("Link a current lease before using payment ledger actions.")).toBeInTheDocument();
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
