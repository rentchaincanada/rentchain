import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantWorkspacePage from "./TenantWorkspacePage";
import TenantApplicationStatusPage from "./TenantApplicationStatusPage";
import TenantLeasePage from "./TenantLeasePage";
import TenantMaintenanceRequestsPage from "./TenantMaintenanceRequestsPage";
import TenantInviteRedeemPage from "./TenantInviteRedeemPage";
import { TenantNav } from "../../components/layout/TenantNav";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
  getTenantApplicationStatus: vi.fn(),
  getTenantLeaseWorkspace: vi.fn(),
  listTenantWorkspaceMaintenance: vi.fn(),
  redeemTenantWorkspaceInvite: vi.fn(),
}));

const maintenanceWorkflowApi = vi.hoisted(() => ({
  listTenantMaintenance: vi.fn(),
}));

const tenantCommunicationsApi = vi.hoisted(() => ({
  getTenantCommunicationSummary: vi.fn(),
}));

vi.mock("../../api/tenantPortal", () => tenantPortalApi);
vi.mock("../../api/tenantCommunicationsApi", () => tenantCommunicationsApi);
vi.mock("../../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listTenantMaintenance: maintenanceWorkflowApi.listTenantMaintenance,
  };
});

describe("tenant workspace frontend shell", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantCommunicationsApi.getTenantCommunicationSummary.mockResolvedValue({
      unreadMessages: 1,
      unreadNotices: 2,
      unreadScreeningUpdates: 0,
    });
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
    });
  });

  it("tenant shell renders expected navigation safely", async () => {
    render(
      <MemoryRouter>
        <TenantNav>
          <div>Tenant content</div>
        </TenantNav>
      </MemoryRouter>
    );

    expect(await screen.findByText(/RentChain Tenant Portal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Application/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lease/i })).toBeInTheDocument();
  });

  it("renders loading state safely", () => {
    tenantPortalApi.getTenantWorkspace.mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading your workspace/i)).toBeInTheDocument();
  });

  it("renders workspace summary with safe projected data", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: {
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        street1: "123 Main St",
        street2: "Unit 4",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
        features: ["laundry"],
      },
      application: {
        applicationId: "app-1",
        status: "submitted",
        missingSteps: ["upload_id"],
        nextActions: ["finish_profile"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "active",
        documentUrl: null,
      },
      maintenance: [],
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Tenant Workspace$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Applicant$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Active tenancy/i)).toBeInTheDocument();
    expect(screen.getByText(/123 Main St, Unit 4, Halifax, NS/i)).toBeInTheDocument();
    expect(screen.getByText(/finish_profile/i)).toBeInTheDocument();
  });

  it("renders application status page with safe projected fields", async () => {
    tenantPortalApi.getTenantApplicationStatus.mockResolvedValue({
      applicationId: "app-1",
      status: "submitted",
      missingSteps: ["upload_id"],
      nextActions: ["finish_profile"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Application Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/upload_id/i)).toBeInTheDocument();
  });

  it("renders lease page with safe projected fields", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      status: "active",
      documentUrl: "https://example.com/lease.pdf",
    });

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Lease Summary$/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,800/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open lease document/i })).toBeInTheDocument();
  });

  it("renders maintenance page with safe projected data", async () => {
    maintenanceWorkflowApi.listTenantMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Leaky tap",
          status: "submitted",
          priority: "normal",
          category: "general",
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    });

    render(
      <MemoryRouter>
        <TenantMaintenanceRequestsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Maintenance$/i)).toBeInTheDocument();
    expect(screen.getByText(/Leaky tap/i)).toBeInTheDocument();
  });

  it("invite redemption page handles success state", async () => {
    tenantPortalApi.redeemTenantWorkspaceInvite.mockResolvedValue({
      inviteId: "invite-1",
      propertyId: "prop-1",
      applicationId: "app-1",
      rc_prop_id: "rc-prop-1",
      status: "redeemed",
    });

    render(
      <MemoryRouter>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Invite token/i }), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Redeem invite/i }));

    expect(await screen.findByText(/Invite redeemed/i)).toBeInTheDocument();
  });

  it("invite redemption page handles expired or reused states", async () => {
    tenantPortalApi.redeemTenantWorkspaceInvite.mockRejectedValue({
      payload: { error: "invite_expired" },
      message: "invite_expired",
    });

    render(
      <MemoryRouter>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Invite token/i }), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Redeem invite/i }));

    expect(await screen.findByText(/This invite has expired/i)).toBeInTheDocument();
  });

  it("unauthorized workspace response renders safe denial state", async () => {
    tenantPortalApi.getTenantWorkspace.mockRejectedValue({
      payload: { error: "FORBIDDEN" },
      message: "FORBIDDEN",
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/cannot open this workspace/i)).toBeInTheDocument();
  });

  it("empty state renders safely for application and maintenance", async () => {
    tenantPortalApi.getTenantApplicationStatus.mockResolvedValue(null);
    maintenanceWorkflowApi.listTenantMaintenance.mockResolvedValue({ items: [] });

    const applicationRender = render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No application status yet/i)).toBeInTheDocument();
    applicationRender.unmount();

    render(
      <MemoryRouter>
        <TenantMaintenanceRequestsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No maintenance requests yet/i)).toBeInTheDocument();
  });
});
