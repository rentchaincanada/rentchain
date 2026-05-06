import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssetTokenizationReadinessPage from "./AssetTokenizationReadinessPage";

const mockFetchAssetTokenizationReadiness = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/assetTokenizationReadinessApi", () => ({
  fetchAssetTokenizationReadiness: (...args: any[]) => mockFetchAssetTokenizationReadiness(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const readiness = {
  assetReadinessId: "asset_tokenization_readiness:landlord-1:property:property-1",
  assetType: "property",
  status: "partially_ready",
  manualReviewRequired: true,
  tokenIssuanceEnabled: false,
  blockchainIntegrationEnabled: false,
  publicMarketplaceEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    tokenizationEligibleReferences: 0,
  },
  assetReferences: [],
  cashflowReferences: [],
  occupancyReferences: [],
  maintenancePerformanceReferences: [],
  settlementReadinessReferences: [],
  regulatoryProfileReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  redactions: ["Investor data and securities-offering materials are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("AssetTokenizationReadinessPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAssetTokenizationReadiness.mockResolvedValue([readiness]);
  });

  it("renders asset tokenization readiness and required safety copy", async () => {
    render(
      <MemoryRouter>
        <AssetTokenizationReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Asset tokenization readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No token issuance, blockchain integration, or public marketplace is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Investor data and securities-offering materials are excluded.")).toBeInTheDocument();
  });

  it("updates deterministic property, asset type, and status filters", async () => {
    render(
      <MemoryRouter>
        <AssetTokenizationReadinessPage />
      </MemoryRouter>
    );

    await screen.findByText("Asset tokenization readiness");
    fireEvent.change(screen.getAllByLabelText("Property reference")[0], { target: { value: "property-2" } });
    fireEvent.change(screen.getAllByLabelText("Asset type")[0], { target: { value: "lease_cashflow" } });
    fireEvent.change(screen.getAllByLabelText("Status")[0], { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchAssetTokenizationReadiness).toHaveBeenLastCalledWith({
        propertyId: "property-2",
        assetType: "lease_cashflow",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchAssetTokenizationReadiness.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <AssetTokenizationReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No asset-tokenization readiness references match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Deploy contract")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect blockchain")).not.toBeInTheDocument();
    expect(screen.queryByText("Public marketplace")).not.toBeInTheDocument();
    expect(screen.queryByText("Issue asset")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous tokenization")).not.toBeInTheDocument();
    expect(screen.queryByText("Investor onboarding")).not.toBeInTheDocument();
  });
});
