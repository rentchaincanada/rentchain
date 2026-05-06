import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VerifiedRentalHistoryPage from "./VerifiedRentalHistoryPage";

const mockFetchRentalHistoryLedgers = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/rentalHistoryLedgerApi", () => ({
  fetchRentalHistoryLedgers: (...args: any[]) => mockFetchRentalHistoryLedgers(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const ledger = {
  ledgerId: "verified_rental_history:tenant:tenant-1",
  identityId: "tenant:tenant-1",
  ledgerType: "tenant_rental_history",
  status: "partially_verified",
  manualReviewRequired: true,
  publiclyShareable: false,
  externalInstitutionSharingEnabled: false,
  tokenizationEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalEntries: 1,
    verifiedEntries: 0,
    partiallyVerifiedEntries: 1,
    blockedEntries: 0,
    unavailableEntries: 0,
    propertiesReferenced: 1,
    leasesReferenced: 1,
    maintenanceReferences: 0,
    delinquencyReviewReferences: 0,
  },
  historyEntries: [],
  verificationReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  consentReferences: [],
  redactions: ["Payment account details are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("VerifiedRentalHistoryPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRentalHistoryLedgers.mockResolvedValue([ledger]);
  });

  it("renders verified rental history and required safety copy", async () => {
    render(
      <MemoryRouter>
        <VerifiedRentalHistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Verified rental history")).toBeInTheDocument();
    expect(screen.getAllByText(/No public sharing, bureau reporting, or tokenization is enabled/i).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("tenant:tenant-1")).length).toBeGreaterThan(0);
    expect(screen.getByText("Payment account details are excluded.")).toBeInTheDocument();
  });

  it("updates deterministic filters", async () => {
    render(
      <MemoryRouter>
        <VerifiedRentalHistoryPage />
      </MemoryRouter>
    );

    await screen.findByText("tenant:tenant-1");
    fireEvent.change(screen.getAllByLabelText("Identity reference")[0], { target: { value: "tenant-2" } });
    fireEvent.change(screen.getAllByLabelText("Status")[0], { target: { value: "verified" } });

    await waitFor(() => {
      expect(mockFetchRentalHistoryLedgers).toHaveBeenLastCalledWith({ identityId: "tenant-2", status: "verified" });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchRentalHistoryLedgers.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <VerifiedRentalHistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No rental-history references match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Publish history")).not.toBeInTheDocument();
    expect(screen.queryByText("Report to bureau")).not.toBeInTheDocument();
    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Public profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous verification")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve automatically")).not.toBeInTheDocument();
  });
});
