import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContractorJobsPage from "./ContractorJobsPage";

const apiMocks = vi.hoisted(() => ({
  listContractorMaintenanceJobs: vi.fn(),
  patchContractorMaintenanceJobStatus: vi.fn(),
  uploadContractorMaintenanceEvidence: vi.fn(),
}));

vi.mock("../../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listContractorMaintenanceJobs: apiMocks.listContractorMaintenanceJobs,
    patchContractorMaintenanceJobStatus: apiMocks.patchContractorMaintenanceJobStatus,
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
    apiMocks.patchContractorMaintenanceJobStatus.mockReset();
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
});
