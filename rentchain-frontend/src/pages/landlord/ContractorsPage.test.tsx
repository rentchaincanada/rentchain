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
  useEntitlements: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: mocks.useEntitlements,
}));

vi.mock("@/components/billing/FeatureTeaser", () => ({
  FeatureTeaser: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
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
    mocks.useEntitlements.mockReset();
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      canViewMarketplaceDirectory: true,
    });
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
    mocks.updateContractorProfile.mockResolvedValue({
      id: "contractor-1",
      displayName: "Harbor Plumbing",
      availabilityStatus: "active",
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

  it("renders invite history in a mobile-safe presentation with invite actions", async () => {
    mocks.listContractorInvites.mockResolvedValue([
      {
        id: "invite-1",
        email: "very.long.contractor.email@example.test",
        status: "pending",
        inviteLink: "https://example.test/invite/one",
        createdAtMs: Date.UTC(2026, 5, 1, 12, 0),
        expiresAtMs: Date.UTC(2026, 5, 8, 12, 0),
        acceptedAtMs: null,
      },
    ]);

    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByLabelText("Invite history table")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite history cards")).toBeInTheDocument();
    expect(screen.getAllByText("very.long.contractor.email@example.test").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open invite link/i })).toHaveAttribute(
      "href",
      "https://example.test/invite/one"
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Resend/i })[0]);

    await waitFor(() => {
      expect(mocks.resendContractorInvite).toHaveBeenCalledWith("invite-1");
    });
  });

  it("renders a teaser state when marketplace directory access is unavailable", async () => {
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      canViewMarketplaceDirectory: false,
    });

    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unlock the full contractor directory on Pro/i)).toBeInTheDocument();
    expect(mocks.listContractorInvites).toHaveBeenCalled();
    expect(mocks.fetchContractors).toHaveBeenCalled();
    expect(screen.queryByText(/Create contractor profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invite contractor/i)).not.toBeInTheDocument();
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

  it("populates the embedded form when editing a selected contractor", async () => {
    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Harbor Plumbing Ltd\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit profile/i }));

    expect(screen.getByText("Editing Harbor Plumbing")).toBeInTheDocument();
    expect(screen.getByText(/Edit contractor profile/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Harbor Plumbing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Harbor Plumbing Ltd.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("plumbing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Halifax")).toBeInTheDocument();
  });

  it("hides inactive contractors in the active view and shows them in archived view", async () => {
    mocks.fetchContractors.mockImplementation(async (params?: { availabilityStatus?: string }) => {
      if (params?.availabilityStatus === "inactive") {
        return {
          items: [
            {
              version: "v1",
              id: "contractor-2",
              displayName: "Archived Electric",
              businessName: "Archived Electric Ltd.",
              serviceCategories: ["electrical"],
              serviceAreas: ["Halifax"],
              availabilityStatus: "inactive",
              contact: { email: "archive@electric.test" },
              summary: "Archived contractor profile.",
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
            },
          ],
        };
      }
      return {
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
      };
    });

    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbor Plumbing")).toBeInTheDocument();
    expect(screen.queryByText("Archived Electric")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Archived contractors/i }));

    expect(await screen.findByText("Archived Electric")).toBeInTheDocument();
    expect(screen.queryByText("Harbor Plumbing")).not.toBeInTheDocument();
  });

  it("archives an active contractor and restores an archived contractor through the existing update path", async () => {
    mocks.fetchContractors.mockImplementation(async (params?: { availabilityStatus?: string }) => {
      if (params?.availabilityStatus === "inactive") {
        return {
          items: [
            {
              version: "v1",
              id: "contractor-2",
              displayName: "Archived Electric",
              businessName: "Archived Electric Ltd.",
              serviceCategories: ["electrical"],
              serviceAreas: ["Halifax"],
              availabilityStatus: "inactive",
              contact: { email: "archive@electric.test" },
              summary: "Archived contractor profile.",
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
            },
          ],
        };
      }
      return {
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
      };
    });

    render(
      <MemoryRouter>
        <ContractorsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbor Plumbing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Archive contractor/i }));
    await waitFor(() =>
      expect(mocks.updateContractorProfile).toHaveBeenCalledWith("contractor-1", { availabilityStatus: "inactive" })
    );

    fireEvent.click(screen.getByRole("button", { name: /Archived contractors/i }));
    expect(await screen.findByText("Archived Electric")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Restore contractor/i }));
    await waitFor(() =>
      expect(mocks.updateContractorProfile).toHaveBeenCalledWith("contractor-2", { availabilityStatus: "active" })
    );
  });
});
