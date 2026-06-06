import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContractorProfilePage from "./ContractorProfilePage";

const apiMocks = vi.hoisted(() => ({
  getContractorPortalProfile: vi.fn(),
  updateContractorPortalProfile: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({ user: { id: "contractor-1", role: "contractor" } }),
}));

vi.mock("../../api/contractorPortalApi", () => ({
  getContractorPortalProfile: apiMocks.getContractorPortalProfile,
  updateContractorPortalProfile: apiMocks.updateContractorPortalProfile,
}));

vi.mock("../../api/workOrdersApi", () => ({
  createContractorProfile: vi.fn(),
  getContractorProfile: vi.fn(),
  patchContractorProfile: vi.fn(),
}));

describe("ContractorProfilePage", () => {
  beforeEach(() => {
    cleanup();
    apiMocks.getContractorPortalProfile.mockReset();
    apiMocks.updateContractorPortalProfile.mockReset();
  });

  it("loads and saves the authenticated contractor profile through the scoped portal API", async () => {
    apiMocks.getContractorPortalProfile.mockResolvedValue({
      id: "contractor-1",
      name: "Casey North",
      businessName: "Harbor Plumbing",
      phone: "555-1000",
      specialties: ["plumbing"],
      serviceAreas: ["Halifax"],
      availability: "active",
      bio: "Emergency plumbing",
    });
    apiMocks.updateContractorPortalProfile.mockResolvedValue({ ok: true });

    render(<ContractorProfilePage />);

    expect(await screen.findByDisplayValue("Harbor Plumbing")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "555-2000" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(apiMocks.updateContractorPortalProfile).toHaveBeenCalledWith(
        "contractor-1",
        expect.objectContaining({
          businessName: "Harbor Plumbing",
          phone: "555-2000",
          specialties: ["plumbing"],
        })
      );
    });
  });
});
