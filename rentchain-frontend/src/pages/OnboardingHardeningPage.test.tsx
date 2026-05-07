import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingHardeningPage from "./OnboardingHardeningPage";

const mockFetchLandlord = vi.fn();
const mockFetchTenant = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/onboardingHardeningApi", () => ({
  fetchLandlordOnboardingHardeningProfiles: (...args: any[]) => mockFetchLandlord(...args),
  fetchTenantOnboardingHardeningProfiles: (...args: any[]) => mockFetchTenant(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  onboardingHardeningId: "onboarding_hardening:landlord:landlord-1",
  participantType: "landlord",
  participantId: "landlord-1",
  status: "ready_for_review",
  manualReviewRequired: true,
  autonomousOnboardingEnabled: false,
  autonomousScreeningActivationEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  completionReferences: [],
  profileReferences: [],
  screeningReadinessReferences: [],
  integrationReadinessReferences: [],
  frictionReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  onboardingRestrictions: [],
  redactions: ["Sensitive onboarding payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("OnboardingHardeningPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchLandlord.mockResolvedValue([profile]);
    mockFetchTenant.mockResolvedValue([{ ...profile, participantType: "tenant", participantId: "tenant-1" }]);
  });

  it("loads landlord onboarding hardening with required safety copy", async () => {
    render(
      <MemoryRouter>
        <OnboardingHardeningPage participantType="landlord" />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading onboarding hardening...")).toBeInTheDocument();
    expect(await screen.findByText("Onboarding readiness summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Onboarding readiness is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchLandlord).toHaveBeenCalledWith({ participantType: "landlord", status: "" });
  });

  it("loads tenant onboarding hardening through the tenant API", async () => {
    render(
      <MemoryRouter>
        <OnboardingHardeningPage participantType="tenant" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tenant onboarding hardening")).toBeInTheDocument();
    expect(mockFetchTenant).toHaveBeenCalledWith({ participantType: "tenant", status: "" });
    expect(mockFetchLandlord).not.toHaveBeenCalled();
  });

  it("filters profiles by status", async () => {
    render(
      <MemoryRouter>
        <OnboardingHardeningPage participantType="landlord" />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchLandlord).toHaveBeenLastCalledWith({ participantType: "landlord", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchLandlord.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <OnboardingHardeningPage participantType="landlord" />
      </MemoryRouter>
    );

    expect(await screen.findByText("No onboarding hardening profiles match these filters.")).toBeInTheDocument();
  });
});
