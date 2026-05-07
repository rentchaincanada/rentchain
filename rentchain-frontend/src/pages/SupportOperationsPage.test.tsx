import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupportOperationsPage from "./SupportOperationsPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/supportOperationsApi", () => ({
  fetchSupportOperationsProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  supportOperationsId: "support_operations:production-support-operations-console-v1",
  status: "stable",
  manualReviewRequired: true,
  autonomousSupportExecutionEnabled: false,
  adminImpersonationEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  supportReferences: [],
  onboardingReferences: [],
  credentialingReferences: [],
  incidentReferences: [],
  operationalRiskReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  supportRestrictions: [],
  redactions: ["Sensitive support payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("SupportOperationsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads support operations with required safety copy", async () => {
    render(
      <MemoryRouter>
        <SupportOperationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading support operations...")).toBeInTheDocument();
    expect(await screen.findByText("Support readiness summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Support and operations workflows are operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No autonomous operational intervention or unrestricted impersonation is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ status: "" });
  });

  it("filters profiles by status", async () => {
    render(
      <MemoryRouter>
        <SupportOperationsPage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SupportOperationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No support operations profiles match these filters.")).toBeInTheDocument();
  });
});
