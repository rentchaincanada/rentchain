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
  updateTenantMaintenanceReopen: vi.fn(),
  updateTenantMaintenanceReworkAccess: vi.fn(),
  updateTenantMaintenanceReworkSignoff: vi.fn(),
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
    updateTenantMaintenanceReopen: maintenanceWorkflowApi.updateTenantMaintenanceReopen,
    updateTenantMaintenanceReworkAccess: maintenanceWorkflowApi.updateTenantMaintenanceReworkAccess,
    updateTenantMaintenanceReworkSignoff: maintenanceWorkflowApi.updateTenantMaintenanceReworkSignoff,
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
          notifications: {
            tenant: {
              requiresAccessConfirmation: false,
              requiresSignoff: false,
              requiresReworkAwareness: true,
            },
          },
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
    expect(screen.getAllByText(/Action needed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Rework in progress/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduling \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Upcoming service window: No service window has been confirmed yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Confirmation \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Execution \/ completion/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resolution \/ closure/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reopen \/ follow-up/i).length).toBeGreaterThan(0);
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
        serviceStartedAt: Date.UTC(2026, 3, 15, 13, 15),
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
        completionSummary: "Heat was restored and the thermostat was recalibrated.",
        notifications: {
          tenant: {
            requiresAccessConfirmation: true,
            requiresSignoff: false,
            requiresReworkAwareness: true,
          },
        },
        reworkCycle: {
          cycleNumber: 1,
          status: "in_progress",
          createdAt: 210,
          createdBy: "landlord-1",
          startedAt: 220,
          completionSummary: null,
        },
        reworkHistory: [
          {
            cycleNumber: 0,
            completedAt: 205,
            outcome: "partial",
            notes: "Initial completion required a second pass.",
          },
        ],
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
        cost: {
          actualCostCents: 24500,
          currency: "CAD",
          reviewStatus: "approved",
        },
        costLineItems: [{ id: "line-1", label: "Labor", amountCents: 24500, category: "labor" }],
        costAttachments: [
          {
            id: "invoice-1",
            fileName: "invoice.pdf",
            uploadedAt: 260,
            uploadedByRole: "contractor",
            uploadedById: "contractor-1",
            visibility: "landlord_only",
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
    expect(screen.getAllByText(/Action needed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirm access for return visit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Scheduling \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Access needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Confirmation \/ access/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Execution \/ completion/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resolution \/ closure/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Work in progress/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completion note/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up \/ rework/i)).toBeInTheDocument();
    expect(screen.getByText(/Rework #1 is in progress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm service window/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request schedule change/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge access/i })).toBeInTheDocument();
    expect(screen.getByText(/Completion photos/i)).toBeInTheDocument();
    expect(screen.getByText(/Heat restored/i)).toBeInTheDocument();
    expect(screen.getByText(/Status timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Technician is on site/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cost & Invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/245\.00 CAD/i)).not.toBeInTheDocument();
  });

  it("lets the tenant reopen a closed request when the issue comes back", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-closed",
        title: "Window latch",
        description: "The latch was repaired but failed again.",
        status: "completed",
        priority: "normal",
        category: "GENERAL",
        resolutionStatus: "resolved",
        tenantSignoffStatus: "accepted",
        finalResolvedAt: Date.UTC(2026, 3, 16, 12, 0),
        createdAt: 100,
        updatedAt: 200,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceReopen.mockResolvedValue({
      item: {
        id: "maint-closed",
        title: "Window latch",
        description: "The latch was repaired but failed again.",
        status: "completed",
        priority: "normal",
        category: "GENERAL",
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: "The latch failed again after closing.",
        tenantSignoffStatus: "declined",
        tenantDeclinedAt: Date.UTC(2026, 3, 17, 9, 0),
        reopenReason: "The latch failed again after closing.",
        reopenedAt: Date.UTC(2026, 3, 17, 9, 0),
        reopenedByActorRole: "tenant",
        createdAt: 100,
        updatedAt: 300,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-closed"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Reopen \/ follow-up/i)).length).toBeGreaterThan(0);
    fireEvent.change(await screen.findByPlaceholderText(/Explain what still needs attention/i), {
      target: { value: "The latch failed again after closing." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reopen request/i }));

    await waitFor(() =>
      expect(maintenanceWorkflowApi.updateTenantMaintenanceReopen).toHaveBeenCalledWith("maint-closed", {
        reason: "The latch failed again after closing.",
      })
    );
    expect(await screen.findByText(/Your request has been reopened/i)).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: /Confirm issue resolved/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceSignoff).toHaveBeenCalledWith("maint-1", {
        decision: "resolved",
        reason: undefined,
      });
    });
    expect((await screen.findAllByText(/This request has been marked resolved/i)).length).toBeGreaterThan(0);
  });

  it("shows a still-needs-attention closure state in tenant detail", async () => {
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
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: "Back bedroom still feels cold overnight.",
        tenantDeclineReason: "Back bedroom still feels cold overnight.",
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

    expect((await screen.findAllByText(/Resolution \/ closure/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Still needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Back bedroom still feels cold overnight/i).length).toBeGreaterThan(0);
  });

  it("submits tenant rework signoff from the detail page when a second-pass review is pending", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-rework-review",
        title: "Heater follow-up",
        description: "Bedroom still feels cool after the return visit.",
        status: "completed",
        priority: "urgent",
        category: "HVAC",
        resolutionStatus: "tenant_pending_signoff",
        reworkCycle: {
          cycleNumber: 1,
          status: "completed",
          createdAt: 200,
          createdBy: "landlord-1",
          completedAt: 360,
          completionSummary: "Balanced vents and re-tested the system.",
        },
        reworkReview: {
          status: "tenant_pending_signoff",
          tenantSignoffStatus: "pending",
        },
        createdAt: 100,
        updatedAt: 400,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceReworkSignoff.mockResolvedValue({
      item: {
        id: "maint-rework-review",
        title: "Heater follow-up",
        description: "Bedroom still feels cool after the return visit.",
        status: "completed",
        priority: "urgent",
        category: "HVAC",
        resolutionStatus: "resolved",
        reworkCycle: {
          cycleNumber: 1,
          status: "completed",
          createdAt: 200,
          createdBy: "landlord-1",
          completedAt: 360,
          completionSummary: "Balanced vents and re-tested the system.",
        },
        reworkReview: {
          status: "closed",
          tenantSignoffStatus: "accepted",
          tenantSignedOffAt: 500,
          closureOutcome: "resolved",
          closedAt: 500,
        },
        finalResolvedAt: 500,
        createdAt: 100,
        updatedAt: 500,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-rework-review"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Review the return visit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mark follow-up resolved/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceReworkSignoff).toHaveBeenCalledWith("maint-rework-review", {
        decision: "resolved",
        reason: undefined,
      });
    });

    expect(await screen.findByText(/The follow-up work has been closed/i)).toBeInTheDocument();
  });

  it("shows return-visit coordination and lets the tenant confirm access", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-rework",
        title: "Return visit for heater",
        description: "Second-pass airflow balancing is needed.",
        status: "assigned",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        resolutionStatus: "completed_pending_review",
        reworkCycle: {
          cycleNumber: 1,
          status: "assigned",
          createdAt: 200,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-1",
          assignedAt: 210,
          schedule: {
            scheduledFor: Date.UTC(2026, 4, 2, 13, 30),
            timeWindowStart: null,
            timeWindowEnd: null,
            status: "tenant_pending",
            requiresTenantAccess: true,
            tenantAccessStatus: "pending",
          },
        },
        createdAt: 100,
        updatedAt: 220,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceReworkAccess.mockResolvedValue({
      item: {
        id: "maint-rework",
        title: "Return visit for heater",
        description: "Second-pass airflow balancing is needed.",
        status: "assigned",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        resolutionStatus: "completed_pending_review",
        reworkCycle: {
          cycleNumber: 1,
          status: "assigned",
          createdAt: 200,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-1",
          assignedAt: 210,
          schedule: {
            scheduledFor: Date.UTC(2026, 4, 2, 13, 30),
            timeWindowStart: null,
            timeWindowEnd: null,
            status: "confirmed",
            requiresTenantAccess: true,
            tenantAccessStatus: "confirmed",
          },
        },
        createdAt: 100,
        updatedAt: 225,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-rework"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Return visit coordination/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: tenant pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm return visit access/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm return visit access/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceReworkAccess).toHaveBeenCalledWith("maint-rework", {
        decision: "confirm",
        note: undefined,
      });
    });

    expect((await screen.findAllByText(/confirmed/i)).length).toBeGreaterThan(0);
  });

  it("lets the tenant deny return-visit access with a note", async () => {
    maintenanceWorkflowApi.getTenantMaintenance.mockResolvedValue({
      item: {
        id: "maint-rework",
        title: "Return visit for heater",
        description: "Second-pass airflow balancing is needed.",
        status: "assigned",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        resolutionStatus: "completed_pending_review",
        reworkCycle: {
          cycleNumber: 1,
          status: "assigned",
          createdAt: 200,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-1",
          assignedAt: 210,
          schedule: {
            scheduledFor: Date.UTC(2026, 4, 2, 13, 30),
            timeWindowStart: null,
            timeWindowEnd: null,
            status: "tenant_pending",
            requiresTenantAccess: true,
            tenantAccessStatus: "pending",
          },
        },
        createdAt: 100,
        updatedAt: 220,
        statusHistory: [],
      },
    });
    maintenanceWorkflowApi.updateTenantMaintenanceReworkAccess.mockResolvedValue({
      item: {
        id: "maint-rework",
        title: "Return visit for heater",
        description: "Second-pass airflow balancing is needed.",
        status: "assigned",
        priority: "urgent",
        category: "HVAC",
        assignedContractorName: "North Shore HVAC",
        contractorStatus: "assigned",
        resolutionStatus: "completed_pending_review",
        reworkCycle: {
          cycleNumber: 1,
          status: "assigned",
          createdAt: 200,
          createdBy: "landlord-1",
          assignedContractorId: "contractor-1",
          assignedAt: 210,
          schedule: {
            scheduledFor: Date.UTC(2026, 4, 2, 13, 30),
            timeWindowStart: null,
            timeWindowEnd: null,
            status: "reschedule_requested",
            requiresTenantAccess: true,
            tenantAccessStatus: "denied",
            tenantAccessNote: "I will be away that afternoon.",
          },
        },
        createdAt: 100,
        updatedAt: 230,
        statusHistory: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenant/maintenance/maint-rework"]}>
        <Routes>
          <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText(/Add an optional note about access for the return visit/i), {
      target: { value: "I will be away that afternoon." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Deny access \/ request reschedule/i }));

    await waitFor(() => {
      expect(maintenanceWorkflowApi.updateTenantMaintenanceReworkAccess).toHaveBeenCalledWith("maint-rework", {
        decision: "deny",
        note: "I will be away that afternoon.",
      });
    });

    expect(await screen.findByText(/Status: reschedule requested/i)).toBeInTheDocument();
    expect(screen.getAllByText(/I will be away that afternoon./i).length).toBeGreaterThan(0);
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
