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
  updateTenantMaintenanceConfirmation: vi.fn(),
  updateTenantMaintenanceSignoff: vi.fn(),
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
    updateTenantMaintenanceConfirmation: maintenanceWorkflowApi.updateTenantMaintenanceConfirmation,
    updateTenantMaintenanceSignoff: maintenanceWorkflowApi.updateTenantMaintenanceSignoff,
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
          serviceWindowStartAt: null,
          serviceWindowEndAt: null,
          accessRequired: null,
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
    expect(screen.getAllByText(/Scheduling \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Upcoming service window: No service window has been confirmed yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Confirmation \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/landlord needs to confirm the service window/i)).toBeInTheDocument();
  });

  it("renders the tenant maintenance detail with confirmation actions and timeline", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "scheduled",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
        evidence: [
          {
            id: "evidence-1",
            url: "https://example.com/completion.jpg",
            uploadedAt: 250,
            uploadedByActorRole: "landlord",
            uploadedByActorId: "landlord-1",
            evidenceType: "completion",
            caption: "Heat restored",
            visibility: "tenant_safe",
          },
        ],
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
    expect(screen.getByText(/Handling status/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduling \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Access needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Confirmation \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Confirm service window/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request schedule change/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge access/i })).toBeInTheDocument();
    expect(screen.getByText(/Completion photos/i)).toBeInTheDocument();
    expect(screen.getByText(/Heat restored/i)).toBeInTheDocument();
    expect(screen.getByText(/Status timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Technician is on site/i)).toBeInTheDocument();
  });

  it("submits tenant confirmation updates from the detail page", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "scheduled",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
        createdAt: 100,
        updatedAt: 200,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceConfirmation.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "scheduled",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
        tenantConfirmationStatus: "confirmed",
        tenantConfirmationUpdatedAt: 300,
        accessAcknowledgedAt: 301,
        createdAt: 100,
        updatedAt: 400,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-1"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Confirm service window/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceConfirmation).toHaveBeenCalledWith("maint-1", {
        confirmationStatus: "confirmed",
      });
    });
    expect(await screen.findByText(/The tenant has confirmed the service window and acknowledged the access requirement/i)).toBeInTheDocument();
  });

  it("submits tenant resolution signoff from the detail page", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "completed",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "completed",
        resolutionStatus: "tenant_pending_signoff",
        landlordApprovedAt: 350,
        createdAt: 100,
        updatedAt: 400,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceSignoff.mockResolvedValue({
      item: {
        id: "maint-1",
        title: "Broken heater",
        description: "The heat is not turning on.",
        status: "completed",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "completed",
        resolutionStatus: "resolved",
        tenantSignoffStatus: "accepted",
        tenantSignedOffAt: 500,
        finalResolvedAt: 500,
        createdAt: 100,
        updatedAt: 500,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-1"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Mark resolved/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceSignoff).toHaveBeenCalledWith("maint-1", {
        decision: "resolved",
        reason: undefined,
      });
    });
    expect(await screen.findByText(/This request has been marked resolved/i)).toBeInTheDocument();
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
