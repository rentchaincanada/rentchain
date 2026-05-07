import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstitutionOnboardingReadinessPage from "./InstitutionOnboardingReadinessPage";

const mockFetchInstitutionOnboardingReadiness = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/institutionOnboardingApi", () => ({
  fetchInstitutionOnboardingReadiness: (...args: any[]) => mockFetchInstitutionOnboardingReadiness(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const readiness = {
  onboardingReadinessId: "institution_onboarding_readiness:landlord-1:lender",
  institutionType: "lender",
  status: "ready_for_review",
  manualReviewRequired: true,
  externalOnboardingEnabled: false,
  autonomousApprovalEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  participantReferences: [],
  trustReferences: [],
  identityReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  sharingReferences: [],
  auditReferences: [],
  onboardingRestrictions: [],
  redactions: ["Public onboarding portals and unrestricted institutional directory data are not included."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("InstitutionOnboardingReadinessPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchInstitutionOnboardingReadiness.mockResolvedValue([readiness]);
  });

  it("renders onboarding readiness and required safety copy", async () => {
    render(
      <MemoryRouter>
        <InstitutionOnboardingReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Institution onboarding readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No live institution integration or autonomous onboarding is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Public onboarding portals and unrestricted institutional directory data are not included.")).toBeInTheDocument();
  });

  it("updates deterministic institution and status filters", async () => {
    render(
      <MemoryRouter>
        <InstitutionOnboardingReadinessPage />
      </MemoryRouter>
    );

    await screen.findByText("Institution onboarding readiness");
    fireEvent.change(screen.getByLabelText("Institution type"), { target: { value: "auditor" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchInstitutionOnboardingReadiness).toHaveBeenLastCalledWith({
        institutionType: "auditor",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchInstitutionOnboardingReadiness.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <InstitutionOnboardingReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No institution onboarding readiness items match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Connect lender")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-onboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit onboarding")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous approval")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish onboarding")).not.toBeInTheDocument();
  });
});
