import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TenantMaintenanceRequestsPage from "./TenantMaintenanceRequestsPage";
import TenantMaintenanceRequestDetailPage from "./TenantMaintenanceRequestDetailPage";
import TenantMaintenanceRequestNewPage from "./TenantMaintenanceRequestNewPage";

const maintenanceWorkflowApi = vi.hoisted(() => ({
  listTenantMaintenance: vi.fn(),
  getTenantMaintenance: vi.fn(),
  createTenantMaintenance: vi.fn(),
}));

const tenantAuth = vi.hoisted(() => ({
  getTenantToken: vi.fn(),
  clearTenantToken: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("../../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listTenantMaintenance: maintenanceWorkflowApi.listTenantMaintenance,
    getTenantMaintenance: maintenanceWorkflowApi.getTenantMaintenance,
    createTenantMaintenance: maintenanceWorkflowApi.createTenantMaintenance,
  };
});

vi.mock("../../lib/tenantAuth", () => tenantAuth);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("tenant maintenance pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantAuth.getTenantToken.mockReturnValue("tenant-token");
  });

  it("renders the tenant maintenance list with workflow summary", async () => {
    maintenanceWorkflowApi.listTenantMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Leaky faucet",
          status: "submitted",
          priority: "normal",
          category: "plumbing",
          assignedContractorName: null,
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

    expect(await screen.findByText(/Maintenance workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/A maintenance request is waiting for review/i)).toBeInTheDocument();
    expect(screen.getByText(/Leaky faucet/i)).toBeInTheDocument();
    expect(screen.getByText(/Your request has been submitted and is waiting for landlord review/i)).toBeInTheDocument();
    expect(screen.getByText(/Handling: Awaiting Assignment/i)).toBeInTheDocument();
  });

  it("renders the tenant maintenance detail with next steps and timeline", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "in_progress",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "in_progress",
        createdAt: 100,
        updatedAt: 200,
        statusHistory: [
          {
            status: "in_progress",
            actorRole: "landlord",
            message: "Technician is on site.",
            createdAt: 200,
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-1"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Broken heater/i)).toBeInTheDocument();
    expect(screen.getByText(/What this status means/i)).toBeInTheDocument();
    expect(screen.getByText(/Work is actively underway/i)).toBeInTheDocument();
    expect(screen.getByText(/Handling status/i)).toBeInTheDocument();
    expect(screen.getByText(/Your request is actively being handled/i)).toBeInTheDocument();
    expect(screen.getByText(/Status timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Technician is on site/i)).toBeInTheDocument();
  });

  it("submits the tenant maintenance request form", async () => {
    maintenanceWorkflowApi.createTenantMaintenance.mockResolvedValue({
      requestId: "maint-2",
      status: "submitted",
    });

    render(
      <MemoryRouter>
        <TenantMaintenanceRequestNewPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/How this works/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Leaking kitchen faucet/i), {
      target: { value: "Leaky faucet" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue and any urgency details/i), {
      target: { value: "Water is dripping under the sink." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    expect(maintenanceWorkflowApi.createTenantMaintenance).toHaveBeenCalled();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/tenant/maintenance/maint-2");
    });
  });
});
