import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SettlementReadinessPanel } from "./SettlementReadinessPanel";

const readiness = {
  settlementReadinessId: "settlement_readiness:landlord-1:portfolio:all",
  status: "partially_ready",
  manualReviewRequired: true,
  paymentExecutionEnabled: false,
  bankingIntegrationEnabled: false,
  tokenizationEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    totalLedgerAmount: "2000.00",
    totalReconciledAmount: "1000.00",
  },
  settlementReferences: [],
  reconciliationReferences: [
    {
      settlementReferenceId: "settlement:reconciliation_item:recon-1",
      referenceType: "reconciliation_item",
      status: "verified",
      label: "Reconciliation reference",
      description: "Payment reconciliation metadata is available.",
      amountSummary: { currency: "CAD", amount: null },
      traceability: { ledgerLinked: true, reviewLinked: true, evidenceLinked: true },
      sourceId: "recon-1",
      destination: null,
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  ledgerReferences: [],
  workflowDependencies: [{ dependencyId: "evidence_lineage", label: "Evidence lineage", status: "available", blockedReason: null }],
  evidenceReferences: [],
  reviewReferences: [],
  redactions: ["Raw bank account and routing data are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
} as const;

describe("SettlementReadinessPanel", () => {
  it("renders settlement readiness, lineage, and required safety copy", () => {
    render(
      <MemoryRouter>
        <SettlementReadinessPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View settlement readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No payment execution or banking integration is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View reconciliation lineage")).toBeInTheDocument();
    expect(screen.getByText("Raw bank account and routing data are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden settlement action labels", () => {
    render(
      <MemoryRouter>
        <SettlementReadinessPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Send payment")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute settlement")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect bank")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer funds")).not.toBeInTheDocument();
    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous settlement")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve automatically")).not.toBeInTheDocument();
  });
});
