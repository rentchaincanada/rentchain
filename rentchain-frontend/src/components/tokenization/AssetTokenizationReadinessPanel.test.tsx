import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AssetTokenizationReadinessPanel } from "./AssetTokenizationReadinessPanel";

const readiness = {
  assetReadinessId: "asset_tokenization_readiness:landlord-1:property:property-1",
  assetType: "property",
  status: "blocked",
  manualReviewRequired: true,
  tokenIssuanceEnabled: false,
  blockchainIntegrationEnabled: false,
  publicMarketplaceEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    tokenizationEligibleReferences: 0,
  },
  assetReferences: [
    {
      assetReferenceId: "asset_tokenization:property_identity:property-1",
      referenceType: "property_identity",
      status: "verified",
      label: "Canonical asset reference",
      description: "Property identity metadata is available.",
      reviewRequired: true,
      tokenizationEligible: false,
      sourceId: "property-1",
      destination: "/properties?propertyId=property-1",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  cashflowReferences: [],
  occupancyReferences: [],
  maintenancePerformanceReferences: [],
  settlementReadinessReferences: [
    {
      assetReferenceId: "asset_tokenization:settlement_readiness:settlement-1",
      referenceType: "settlement_readiness",
      status: "blocked",
      label: "Settlement readiness linkage",
      description: "Settlement readiness metadata is available.",
      reviewRequired: true,
      tokenizationEligible: false,
      sourceId: "settlement-1",
      destination: "/settlement-readiness",
      redacted: false,
      redactionReason: null,
      blockedReason: "Settlement readiness is blocked.",
    },
  ],
  regulatoryProfileReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  redactions: ["Blockchain addresses, wallets, and custody metadata are excluded."],
  blockedReasons: ["Settlement readiness is blocked."],
  canonicalEvents: [],
} as const;

describe("AssetTokenizationReadinessPanel", () => {
  it("renders readiness, lineage, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <AssetTokenizationReadinessPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No token issuance, blockchain integration, or public marketplace is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View settlement lineage")).toBeInTheDocument();
    expect(screen.getByText("View blocked reason: Settlement readiness is blocked.")).toBeInTheDocument();
    expect(screen.getByText("Blockchain addresses, wallets, and custody metadata are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden tokenization action labels", () => {
    render(
      <MemoryRouter>
        <AssetTokenizationReadinessPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Deploy contract")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect blockchain")).not.toBeInTheDocument();
    expect(screen.queryByText("Public marketplace")).not.toBeInTheDocument();
    expect(screen.queryByText("Issue asset")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous tokenization")).not.toBeInTheDocument();
    expect(screen.queryByText("Investor onboarding")).not.toBeInTheDocument();
  });
});
