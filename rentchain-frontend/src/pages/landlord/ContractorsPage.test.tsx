import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContractorsPage from "./ContractorsPage";

const mocks = vi.hoisted(() => ({
  listContractorInvites: vi.fn(),
  createContractorInvite: vi.fn(),
  resendContractorInvite: vi.fn(),
  fetchContractors: vi.fn(),
  createContractorProfile: vi.fn(),
  updateContractorProfile: vi.fn(),
}));

vi.mock("../../api/workOrdersApi", () => ({
  listContractorInvites: mocks.listContractorInvites,
  createContractorInvite: mocks.createContractorInvite,
  resendContractorInvite: mocks.resendContractorInvite,
}));

vi.mock("../../api/marketplaceContractorApi", () => ({
  fetchContractors: mocks.fetchContractors,
  createContractorProfile: mocks.createContractorProfile,
  updateContractorProfile: mocks.updateContractorProfile,
}));

describe("ContractorsPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.listContractorInvites.mockReset();
    mocks.createContractorInvite.mockReset();
    mocks.resendContractorInvite.mockReset();
    mocks.fetchContractors.mockReset();
    mocks.createContractorProfile.mockReset();
    mocks.updateContractorProfile.mockReset();
    mocks.listContractorInvites.mockResolvedValue([]);
    mocks.fetchContractors.mockResolvedValue({
      items: [
        {
          version: "v1",
          id: "contractor-1",
          displayName: "Harbor Plumbing",
          businessName: "Harbor Plumbing Ltd.",
          serviceCategories: ["plumbing"],
          serviceAreas: ["Halifax"],
          availabilityStatus: "active",
          contact: { email: "crew@harbor.test" },
          summary: "Fast response for leaks and fixture work.",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
      ],
    });
    mocks.createContractorProfile.mockResolvedValue({
      id: "contractor-2",
      displayName: "North Shore Electric",
    });
  });

  it("renders contractor discovery and invite history safely", async () => {
    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Contractor directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Harbor Plumbing Ltd\./i)).toBeInTheDocument();
    expect(screen.getByText(/No invites yet\./i)).toBeInTheDocument();
  });

  it("creates a contractor profile from the embedded directory form", async () => {
    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Create contractor profile/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Display name/i), {
      target: { value: "North Shore Electric" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Business name/i), {
      target: { value: "North Shore Electric Ltd." },
    });
    fireEvent.change(screen.getByPlaceholderText(/plumbing, hvac/i), {
      target: { value: "electrical" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Halifax, Dartmouth/i), {
      target: { value: "Halifax" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create profile/i }));

    await waitFor(() => {
      expect(mocks.createContractorProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "North Shore Electric",
          businessName: "North Shore Electric Ltd.",
          serviceCategories: ["electrical"],
          serviceAreas: ["Halifax"],
        })
      );
    });
  });
});
