import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RentalDebtPage from "./RentalDebtPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/rentalDebtApi", () => ({
  fetchRentalDebtProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  rentalDebtId: "rental_debt:landlord-1:tenant-1",
  status: "verified",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  collectionsExecutionEnabled: false,
  bureauReportingEnabled: false,
  publicDebtExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  paymentDefaultReferences: [],
  delinquencyReferences: [],
  disputeReferences: [],
  consentReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  debtRestrictions: [],
  redactions: ["Sensitive debt payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("RentalDebtPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders rental debt accountability with required safety copy", async () => {
    render(
      <MemoryRouter>
        <RentalDebtPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading rental debt accountability...")).toBeInTheDocument();
    expect(await screen.findByText("Accountability summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Rental debt accountability is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ tenantId: undefined, status: "" });
  });

  it("filters profiles by tenant and status", async () => {
    render(
      <MemoryRouter>
        <RentalDebtPage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findByLabelText("Tenant reference")), { target: { value: "tenant-1" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ tenantId: "tenant-1", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <RentalDebtPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No rental debt accountability profiles match these filters.")).toBeInTheDocument();
  });
});
