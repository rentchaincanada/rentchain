import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InteroperabilityAdapterPage from "./InteroperabilityAdapterPage";

const mockFetchInteroperabilityAdapterReadiness = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/interoperabilityAdaptersApi", () => ({
  fetchInteroperabilityAdapterReadiness: (...args: any[]) => mockFetchInteroperabilityAdapterReadiness(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const readiness = {
  adapterReadinessId: "interoperability_adapter_readiness:landlord-1:lender",
  adapterType: "lender",
  status: "ready_for_review",
  manualReviewRequired: true,
  liveIntegrationEnabled: false,
  externalSynchronizationEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  compatibilityReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  sharingReferences: [],
  auditReferences: [],
  adapterRestrictions: [],
  redactions: ["Interoperability adapters are readiness metadata only; no external synchronization or execution is enabled."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("InteroperabilityAdapterPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchInteroperabilityAdapterReadiness.mockResolvedValue([readiness]);
  });

  it("renders interoperability readiness and required safety copy", async () => {
    render(
      <MemoryRouter>
        <InteroperabilityAdapterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Interoperability adapters")).toBeInTheDocument();
    expect(screen.getAllByText(/No live integrations or autonomous synchronization is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Interoperability adapters are readiness metadata only; no external synchronization or execution is enabled.")).toBeInTheDocument();
  });

  it("updates deterministic adapter and status filters", async () => {
    render(
      <MemoryRouter>
        <InteroperabilityAdapterPage />
      </MemoryRouter>
    );

    await screen.findByText("Interoperability adapters");
    fireEvent.change(screen.getByLabelText("Adapter type"), { target: { value: "registry" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchInteroperabilityAdapterReadiness).toHaveBeenLastCalledWith({
        adapterType: "registry",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchInteroperabilityAdapterReadiness.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <InteroperabilityAdapterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No interoperability adapter readiness items match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Connect integration")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect lender")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect payment provider")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous integration")).not.toBeInTheDocument();
  });
});
