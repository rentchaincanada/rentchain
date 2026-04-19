import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantsPage } from "./TenantsPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useToastMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  fetchTenantsMock: vi.fn(),
  fetchTenantTenanciesMock: vi.fn(),
  updateTenancyMock: vi.fn(),
  hydrateTenantSummariesBatchMock: vi.fn(),
  getCachedTenantSummaryMock: vi.fn(),
  openUpgradeFlowMock: vi.fn(),
  trackMock: vi.fn(),
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
  updateTenancy: mocks.updateTenancyMock,
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
  ResponsiveMasterDetail: ({ master, detail, searchSlot }: any) => (
    <div>
      {searchSlot}
      {master}
      {detail}
    </div>
  ),
}));

vi.mock("../components/tenants/InviteTenantModal", () => ({
  InviteTenantModal: () => null,
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
    mocks.updateTenancyMock.mockResolvedValue({});
    mocks.hydrateTenantSummariesBatchMock.mockResolvedValue(undefined);
    mocks.getCachedTenantSummaryMock.mockReturnValue(null);
    mocks.openUpgradeFlowMock.mockResolvedValue(true);
    mocks.trackMock.mockReset();
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
});
