import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MaintenanceRequestsPage from "./MaintenanceRequestsPage";

const maintenanceWorkflowApi = vi.hoisted(() => ({
  listLandlordMaintenance: vi.fn(),
  patchLandlordMaintenance: vi.fn(),
  assignLandlordMaintenance: vi.fn(),
}));

const workOrdersApi = vi.hoisted(() => ({
  listContractorInvites: vi.fn(),
  getContractorProfileById: vi.fn(),
}));

const showToast = vi.fn();

vi.mock("../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listLandlordMaintenance: maintenanceWorkflowApi.listLandlordMaintenance,
    patchLandlordMaintenance: maintenanceWorkflowApi.patchLandlordMaintenance,
    assignLandlordMaintenance: maintenanceWorkflowApi.assignLandlordMaintenance,
  };
});

vi.mock("../api/workOrdersApi", () => workOrdersApi);
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

describe("landlord maintenance workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "submitted",
          assignedContractorName: null,
          serviceWindowStartAt: null,
          serviceWindowEndAt: null,
          accessRequired: null,
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [
            {
              status: "submitted",
              actorRole: "tenant",
              message: "Submitted through tenant workspace.",
              createdAt: 100,
            },
          ],
        },
      ],
    });
    workOrdersApi.listContractorInvites.mockResolvedValue([]);
  });

  it("renders the landlord maintenance workspace with lifecycle guidance", async () => {
    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Maintenance Workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/A request is waiting for review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Broken heater/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lifecycle summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignment \/ handling/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No handler has been assigned to this request yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Scheduling \/ access/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmation \/ access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not ready for service/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Execution \/ completion/i)).toBeInTheDocument();
    expect(screen.getByText(/Current service state/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolution \/ closure/i)).toBeInTheDocument();
    expect(screen.getByText(/Verification status/i)).toBeInTheDocument();
    expect(screen.getByText(/Review the request details/i)).toBeInTheDocument();
    expect(screen.getByText(/Mark reviewed/i)).toBeInTheDocument();
  });

  it("shows pending verification and follow-up state in the landlord closure workspace", async () => {
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "completed",
          assignedContractorName: "North Shore HVAC",
          completionSummary: "Heat restored and vents balanced.",
          resolutionStatus: "follow_up_required",
          followUpRequired: true,
          followUpReason: "Back bedroom is still cooler than the rest of the unit.",
          tenantDeclineReason: "Back bedroom is still cooler than the rest of the unit.",
          tenantDeclinedAt: Date.UTC(2026, 3, 16, 10, 0),
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Resolution \/ closure/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Still needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Back bedroom is still cooler than the rest of the unit/i).length).toBeGreaterThan(0);
  });

  it("shows reopened and escalated recovery state in the landlord reopen workspace", async () => {
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "completed",
          assignedContractorName: "North Shore HVAC",
          resolutionStatus: "follow_up_required",
          followUpRequired: true,
          followUpReason: "The bedroom is cold again after the return visit.",
          reopenedAt: Date.UTC(2026, 3, 17, 9, 0),
          reopenReason: "The bedroom is cold again after the return visit.",
          reworkHistory: [
            {
              cycleNumber: 1,
              completedAt: Date.UTC(2026, 3, 16, 14, 0),
              outcome: "partial",
              notes: "Initial return visit improved airflow but did not fully resolve it.",
            },
          ],
          reworkReview: {
            status: "follow_up_required",
            tenantSignoffStatus: "declined",
            tenantDeclinedAt: Date.UTC(2026, 3, 17, 9, 0),
            tenantDeclineReason: "The bedroom is cold again after the return visit.",
            closureOutcome: "needs_more_followup",
            closedAt: null,
          },
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Reopen \/ escalation/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Escalated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/The bedroom is cold again after the return visit/i).length).toBeGreaterThan(0);
  });

  it("records a landlord start-of-service update from the execution workspace", async () => {
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "scheduled",
          assignedContractorName: "North Shore HVAC",
          serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
          serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
          accessRequired: true,
          tenantConfirmationStatus: "confirmed",
          accessAcknowledgedAt: Date.UTC(2026, 3, 14, 11, 0),
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Mark service started/i }));

    expect(maintenanceWorkflowApi.patchLandlordMaintenance).toHaveBeenCalledWith("maint-1", {
      status: "in_progress",
      priority: "urgent",
      landlordNote: "",
      message: "Landlord marked service as started.",
    });
  });

  it("opens the related request from the scheduled maintenance calendar", async () => {
    maintenanceWorkflowApi.listLandlordMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-2",
          tenantName: "Taylor Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          title: "Broken heater",
          description: "Heat is not turning on.",
          category: "HVAC",
          priority: "urgent",
          status: "submitted",
          assignedContractorName: null,
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
        {
          id: "maint-2",
          tenantId: "tenant-2",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-8",
          tenantName: "Jordan Tenant",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 8",
          title: "Leaky pipe",
          description: "Pipe is dripping behind the vanity.",
          category: "PLUMBING",
          priority: "normal",
          status: "scheduled",
          assignedContractorName: "North Shore Plumbing",
          serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
          serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
          accessRequired: false,
          tenantConfirmationStatus: "confirmed",
          tenantConfirmationUpdatedAt: Date.UTC(2026, 3, 14, 10, 0),
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/maintenance/maint-1"]}>
        <Routes>
          <Route path="/maintenance/:id" element={<MaintenanceRequestsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Scheduled maintenance calendar/i)).length).toBeGreaterThan(0);
    fireEvent.click((await screen.findAllByRole("button", { name: /Leaky pipe/i }))[0]);

    expect(await screen.findAllByText(/Leaky pipe/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Ready for service/i).length).toBeGreaterThan(0);
  });
});
