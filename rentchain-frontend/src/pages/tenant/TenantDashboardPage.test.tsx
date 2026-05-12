import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TenantDashboardPage from "./TenantDashboardPage";
import { TENANT_TOKEN_KEY } from "../../lib/authKeys";

const tenantApiFetchApi = vi.hoisted(() => ({
  tenantApiFetch: vi.fn(),
}));

const tenantMaintenanceApi = vi.hoisted(() => ({
  getTenantMaintenanceRequests: vi.fn(),
}));

const tenantScreeningApi = vi.hoisted(() => ({
  listTenantScreenings: vi.fn(),
}));

vi.mock("../../api/tenantApiFetch", () => tenantApiFetchApi);
vi.mock("../../api/tenantMaintenanceApi", () => tenantMaintenanceApi);
vi.mock("../../api/tenantScreeningApi", () => tenantScreeningApi);
vi.mock("../../components/tenant/CreateMaintenanceRequestModal", () => ({
  CreateMaintenanceRequestModal: () => null,
}));

function tenantToken() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

describe("TenantDashboardPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(TENANT_TOKEN_KEY, tenantToken());
    tenantMaintenanceApi.getTenantMaintenanceRequests.mockResolvedValue({ data: [] });
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({ items: [] });
  });

  it("shows the hydrated unit label instead of raw unitId in the primary lease snapshot", async () => {
    tenantApiFetchApi.tenantApiFetch.mockImplementation(async (path: string) => {
      if (path === "/tenant/me") {
        return {
          ok: true,
          data: {
            context: { unitId: "unit-raw-1" },
            tenant: {
              id: "tenant-1",
              shortId: "tenant-1",
              name: "Taylor Tenant",
              email: "tenant@example.com",
              joinedAt: null,
              status: "Active",
            },
            landlord: { name: "Harbour Homes" },
            property: { name: "Harbour View" },
            unit: { label: "Unit 4B" },
            lease: {
              status: "Active",
              startDate: null,
              endDate: null,
              rentCents: null,
              currency: "CAD",
            },
          },
        };
      }
      if (path === "/tenant/messages") return { ok: true, items: [] };
      return { ok: true, data: [] };
    });

    render(<TenantDashboardPage />);

    expect(await screen.findByText("Lease Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Unit 4B")).toBeInTheDocument();
    expect(screen.queryByText("unit-raw-1")).not.toBeInTheDocument();
  });
});
