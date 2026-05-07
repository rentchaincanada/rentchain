import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourtDisputeLineagePage from "./CourtDisputeLineagePage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/courtDisputeLineageApi", () => ({
  fetchCourtDisputeLineageProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  courtDisputeLineageId: "court_dispute_lineage:landlord-1:tenant-1",
  status: "verified",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  legalFilingExecutionEnabled: false,
  collectionsExecutionEnabled: false,
  bureauReportingEnabled: false,
  publicCourtRecordExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  disputeReferences: [],
  courtRecordReferences: [],
  filingReadinessReferences: [],
  judgmentOrderReferences: [],
  rentalDebtReferences: [],
  consentReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  courtDisputeRestrictions: [],
  redactions: ["Sensitive court and dispute payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("CourtDisputeLineagePage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders court/dispute lineage with required safety copy", async () => {
    render(
      <MemoryRouter>
        <CourtDisputeLineagePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading court and dispute lineage...")).toBeInTheDocument();
    expect(await screen.findByText("Lineage summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Court and dispute lineage is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ tenantId: undefined, disputeId: undefined, status: "" });
  });

  it("filters profiles by tenant, dispute, and status", async () => {
    render(
      <MemoryRouter>
        <CourtDisputeLineagePage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findByLabelText("Tenant reference")), { target: { value: "tenant-1" } });
    fireEvent.change(screen.getByLabelText("Dispute reference"), { target: { value: "dispute-1" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ tenantId: "tenant-1", disputeId: "dispute-1", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <CourtDisputeLineagePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No court and dispute lineage profiles match these filters.")).toBeInTheDocument();
  });
});
