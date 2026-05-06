import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SettlementReadinessPage from "./SettlementReadinessPage";

const mockFetchSettlementReadiness = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/settlementReadinessApi", () => ({
  fetchSettlementReadiness: (...args: any[]) => mockFetchSettlementReadiness(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const readiness = {
  settlementReadinessId: "settlement_readiness:landlord-1:portfolio:all",
  status: "partially_ready",
  manualReviewRequired: true,
  paymentExecutionEnabled: false,
  bankingIntegrationEnabled: false,
  tokenizationEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    totalLedgerAmount: "2000.00",
    totalReconciledAmount: "0.00",
  },
  settlementReferences: [],
  reconciliationReferences: [],
  ledgerReferences: [],
  workflowDependencies: [],
  evidenceReferences: [],
  reviewReferences: [],
  redactions: ["PCI-sensitive payment details are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("SettlementReadinessPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSettlementReadiness.mockResolvedValue([readiness]);
  });

  it("renders settlement readiness and required safety copy", async () => {
    render(
      <MemoryRouter>
        <SettlementReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Settlement readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(screen.getByText("PCI-sensitive payment details are excluded.")).toBeInTheDocument();
  });

  it("updates deterministic filters", async () => {
    render(
      <MemoryRouter>
        <SettlementReadinessPage />
      </MemoryRouter>
    );

    await screen.findByText("Settlement readiness");
    fireEvent.change(screen.getAllByLabelText("Property reference")[0], { target: { value: "property-2" } });
    fireEvent.change(screen.getAllByLabelText("Lease reference")[0], { target: { value: "lease-2" } });
    fireEvent.change(screen.getAllByLabelText("Status")[0], { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchSettlementReadiness).toHaveBeenLastCalledWith({
        propertyId: "property-2",
        leaseId: "lease-2",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchSettlementReadiness.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <SettlementReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No settlement-readiness references match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Send payment")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute settlement")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect bank")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer funds")).not.toBeInTheDocument();
    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous settlement")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve automatically")).not.toBeInTheDocument();
  });
});
