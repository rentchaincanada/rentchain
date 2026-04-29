import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
          unitNumber: "101",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
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
});
