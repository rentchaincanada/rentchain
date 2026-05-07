import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommercialReadinessPage from "./CommercialReadinessPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/commercialReadinessApi", () => ({
  fetchCommercialReadinessProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  commercialReadinessId: "commercial_readiness:test",
  status: "ready_for_review",
  manualApprovalRequired: true,
  autonomousBillingEnabled: false,
  autonomousCommercializationEnabled: false,
  publicSelfServiceEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  pricingReferences: [],
  billingReferences: [],
  subscriptionReferences: [],
  onboardingReferences: [],
  supportReferences: [],
  operationalRiskReferences: [],
  releaseReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  commercialRestrictions: [],
  redactions: ["Payment credentials and subscription secrets are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("CommercialReadinessPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders commercial readiness profiles with required safety copy", async () => {
    render(
      <MemoryRouter>
        <CommercialReadinessPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading commercial readiness...")).toBeInTheDocument();
    expect(await screen.findByText("Commercial summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Commercial readiness is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual approval remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ status: "" });
  });

  it("filters readiness profiles by status", async () => {
    render(
      <MemoryRouter>
        <CommercialReadinessPage />
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
        <CommercialReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No commercial readiness profiles match these filters.")).toBeInTheDocument();
  });
});
