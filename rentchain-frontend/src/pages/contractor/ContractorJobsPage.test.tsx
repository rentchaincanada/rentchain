import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContractorJobsPage from "./ContractorJobsPage";

const apiMocks = vi.hoisted(() => ({
  confirmContractorMaintenanceReworkSchedule: vi.fn(),
  listContractorMaintenanceJobs: vi.fn(),
  patchContractorMaintenanceJobStatus: vi.fn(),
  patchContractorMaintenanceReworkStatus: vi.fn(),
  uploadContractorMaintenanceEvidence: vi.fn(),
}));

vi.mock("../../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../../api/maintenanceWorkflowApi");
  return {
    ...actual,
    confirmContractorMaintenanceReworkSchedule: apiMocks.confirmContractorMaintenanceReworkSchedule,
    listContractorMaintenanceJobs: apiMocks.listContractorMaintenanceJobs,
    patchContractorMaintenanceJobStatus: apiMocks.patchContractorMaintenanceJobStatus,
    patchContractorMaintenanceReworkStatus: apiMocks.patchContractorMaintenanceReworkStatus,
    uploadContractorMaintenanceEvidence: apiMocks.uploadContractorMaintenanceEvidence,
  };
});

describe("ContractorJobsPage", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    apiMocks.listContractorMaintenanceJobs.mockReset();
    apiMocks.confirmContractorMaintenanceReworkSchedule.mockReset();
    apiMocks.patchContractorMaintenanceJobStatus.mockReset();
    apiMocks.patchContractorMaintenanceReworkStatus.mockReset();
    apiMocks.uploadContractorMaintenanceEvidence.mockReset();
  });

  it("requires a blocked reason before marking a job blocked", async () => {
    apiMocks.listContractorMaintenanceJobs.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Leaking sink",
          description: "Water is pooling under the sink.",
          status: "scheduled",
          priority: "normal",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyLabel: "Harbour View",
          unitLabel: "Unit 2",
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/contractor/jobs/maint-1"]}>
        <Routes>
          <Route path="/contractor/jobs/:id" element={<ContractorJobsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /mark blocked/i }));

    expect(await screen.findByText(/A blocked job needs a reason/i)).toBeInTheDocument();
    expect(apiMocks.patchContractorMaintenanceJobStatus).not.toHaveBeenCalled();
  });

  it("requires a completion summary before marking a job completed", async () => {
    apiMocks.listContractorMaintenanceJobs.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Broken heater",
          description: "No heat in the bedroom.",
          status: "in_progress",
          priority: "urgent",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyLabel: "Harbour View",
          unitLabel: "Unit 2",
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/contractor/jobs/maint-1"]}>
        <Routes>
          <Route path="/contractor/jobs/:id" element={<ContractorJobsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /mark completed/i }));

    expect(await screen.findByText(/Add a completion summary before finishing the job/i)).toBeInTheDocument();
    expect(apiMocks.patchContractorMaintenanceJobStatus).not.toHaveBeenCalled();
  });

  it("uploads contractor evidence from the selected job", async () => {
    apiMocks.listContractorMaintenanceJobs.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Broken heater",
          description: "No heat in the bedroom.",
          status: "in_progress",
          priority: "urgent",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyLabel: "Harbour View",
          unitLabel: "Unit 2",
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
          evidence: [],
        },
      ],
    });
    apiMocks.uploadContractorMaintenanceEvidence.mockResolvedValue({
      id: "maint-1",
      evidence: [
        {
          id: "evidence-1",
          url: "https://example.com/proof.jpg",
          uploadedAt: 300,
          uploadedByActorRole: "contractor",
          uploadedByActorId: "contractor-1",
          evidenceType: "during",
          caption: "Valve replacement underway",
          visibility: "landlord_contractor",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/contractor/jobs/maint-1"]}>
        <Routes>
          <Route path="/contractor/jobs/:id" element={<ContractorJobsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change((await screen.findAllByLabelText(/Evidence file/i))[0], {
      target: { files: [new File(["photo"], "during.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getAllByLabelText(/^Evidence type$/i)[0], { target: { value: "during" } });
    fireEvent.change(screen.getAllByLabelText(/Evidence caption/i)[0], {
      target: { value: "Valve replacement underway" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Upload evidence/i }));

    await waitFor(() => {
      expect(apiMocks.uploadContractorMaintenanceEvidence).toHaveBeenCalledWith(
        "maint-1",
        expect.objectContaining({
          evidenceType: "during",
          caption: "Valve replacement underway",
        })
      );
    });
  });

  it("shows rework actions and requires a summary before completing rework", async () => {
    apiMocks.listContractorMaintenanceJobs.mockResolvedValue({
      items: [
        {
          id: "maint-rework",
          title: "Return visit for heater",
          description: "Follow-up airflow adjustment.",
          status: "assigned",
          priority: "urgent",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyLabel: "Harbour View",
          unitLabel: "Unit 2",
          resolutionStatus: "completed_pending_review",
          reworkCycle: {
            cycleNumber: 1,
            status: "assigned",
            createdAt: 100,
            createdBy: "landlord-1",
            assignedContractorId: "contractor-1",
            assignedAt: 110,
          },
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/contractor/jobs/maint-rework"]}>
        <Routes>
          <Route path="/contractor/jobs/:id" element={<ContractorJobsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Rework #1/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Start rework/i }));

    await waitFor(() => {
      expect(apiMocks.patchContractorMaintenanceReworkStatus).toHaveBeenCalledWith("maint-rework", {
        status: "in_progress",
        completionSummary: undefined,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Complete rework/i }));
    expect(await screen.findByText(/Add a completion summary before finishing the rework/i)).toBeInTheDocument();
  });

  it("lets the contractor confirm or decline a scheduled rework return visit", async () => {
    apiMocks.listContractorMaintenanceJobs.mockResolvedValue({
      items: [
        {
          id: "maint-rework",
          title: "Return visit for heater",
          description: "Follow-up airflow adjustment.",
          status: "assigned",
          priority: "urgent",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          propertyLabel: "Harbour View",
          unitLabel: "Unit 2",
          resolutionStatus: "completed_pending_review",
          reworkCycle: {
            cycleNumber: 1,
            status: "assigned",
            createdAt: 100,
            createdBy: "landlord-1",
            assignedContractorId: "contractor-1",
            assignedAt: 110,
            schedule: {
              scheduledFor: Date.UTC(2026, 4, 4, 14, 0),
              timeWindowStart: null,
              timeWindowEnd: null,
              status: "scheduled",
              requiresTenantAccess: true,
              tenantAccessStatus: "pending",
              contractorScheduleStatus: "pending",
            },
          },
          createdAt: 100,
          updatedAt: 200,
          statusHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/contractor/jobs/maint-rework"]}>
        <Routes>
          <Route path="/contractor/jobs/:id" element={<ContractorJobsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Awaiting contractor confirmation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm return visit/i }));

    await waitFor(() => {
      expect(apiMocks.confirmContractorMaintenanceReworkSchedule).toHaveBeenCalledWith("maint-rework", {
        decision: "confirm",
        note: undefined,
      });
    });

    fireEvent.change(screen.getByPlaceholderText(/Add schedule details, a blocked reason, or a progress note/i), {
      target: { value: "I am unavailable until the following morning." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Mark unavailable/i }));

    await waitFor(() => {
      expect(apiMocks.confirmContractorMaintenanceReworkSchedule).toHaveBeenCalledWith("maint-rework", {
        decision: "unavailable",
        note: "I am unavailable until the following morning.",
      });
    });
  });
});
