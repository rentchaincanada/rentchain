import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsumerReportingGovernancePage from "./ConsumerReportingGovernancePage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/consumerReportingGovernanceApi", () => ({
  fetchConsumerReportingGovernanceProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  consumerReportingGovernanceId: "consumer_reporting_governance:institutional:v1",
  status: "ready_for_review",
  manualApprovalRequired: true,
  consumerReportingExecutionEnabled: false,
  autonomousReportingEnabled: false,
  publicReportingExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  consentReferences: [],
  disputeReferences: [],
  adverseActionReferences: [],
  credentialingReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  reportingRestrictions: [],
  redactions: ["Sensitive reporting payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ConsumerReportingGovernancePage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders consumer reporting governance with required safety copy", async () => {
    render(
      <MemoryRouter>
        <ConsumerReportingGovernancePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading consumer reporting governance...")).toBeInTheDocument();
    expect(await screen.findByText("Governance summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Consumer reporting governance is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual approval remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ status: "" });
  });

  it("filters profiles by status", async () => {
    render(
      <MemoryRouter>
        <ConsumerReportingGovernancePage />
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
        <ConsumerReportingGovernancePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No consumer reporting governance profiles match these filters.")).toBeInTheDocument();
  });
});
