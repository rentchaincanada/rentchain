import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantParticipationPage from "./TenantParticipationPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/tenantParticipationApi", () => ({
  fetchTenantParticipationProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  tenantParticipationId: "tenant_participation:tenant-1",
  status: "verified",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  publicParticipationExposureEnabled: false,
  autonomousRewardExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  onboardingReferences: [],
  paymentConsistencyReferences: [],
  occupancyReferences: [],
  maintenanceParticipationReferences: [],
  reviewParticipationReferences: [],
  disputeParticipationReferences: [],
  communicationParticipationReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  participationRestrictions: [],
  redactions: ["Sensitive participation payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("TenantParticipationPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders tenant participation with required safety copy", async () => {
    render(
      <MemoryRouter>
        <TenantParticipationPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading tenant participation...")).toBeInTheDocument();
    expect(await screen.findByText("Participation summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Participation references are operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ status: "" });
  });

  it("filters profiles by status", async () => {
    render(
      <MemoryRouter>
        <TenantParticipationPage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findAllByLabelText("Status"))[0], { target: { value: "blocked" } });
    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TenantParticipationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No tenant participation profiles match these filters.")).toBeInTheDocument();
  });
});
