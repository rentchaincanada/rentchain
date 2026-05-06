import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { VerifiedRentalHistoryPanel } from "./VerifiedRentalHistoryPanel";
import type { VerifiedRentalHistoryLedger } from "@/api/rentalHistoryLedgerApi";

const ledger: VerifiedRentalHistoryLedger = {
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
    totalEntries: 2,
    verifiedEntries: 1,
    partiallyVerifiedEntries: 1,
    blockedEntries: 0,
    unavailableEntries: 0,
    propertiesReferenced: 1,
    leasesReferenced: 1,
    maintenanceReferences: 1,
    delinquencyReviewReferences: 1,
  },
  historyEntries: [
    {
      historyEntryId: "entry-1",
      entryType: "lease_participation",
      status: "partially_verified",
      propertyReference: null,
      leaseReference: null,
      occupancyPeriod: { startDate: "2025-01-01T00:00:00.000Z", endDate: null },
      verificationSummary: { verifiedReferences: 2, missingReferences: 0, blockedReferences: 0 },
      reviewLineage: [],
      evidenceLineage: [],
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  verificationReferences: [
    {
      referenceId: "identity:screening-1",
      referenceType: "identity",
      label: "Screening verification",
      status: "available",
      destination: "/identity-layer",
      occurredAt: null,
      redacted: false,
      blockedReason: null,
    },
  ],
  evidenceReferences: [
    {
      referenceId: "evidence:evidence-1",
      referenceType: "evidence",
      label: "Evidence lineage reference",
      status: "available",
      destination: "/evidence-packs",
      occurredAt: null,
      redacted: false,
      blockedReason: null,
    },
  ],
  reviewReferences: [],
  consentReferences: [],
  redactions: ["Raw government identity numbers are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("VerifiedRentalHistoryPanel", () => {
  it("renders lineage, status, redactions, and safety copy", () => {
    render(
      <MemoryRouter>
        <VerifiedRentalHistoryPanel ledger={ledger} />
      </MemoryRouter>
    );

    expect(screen.getByText("tenant:tenant-1")).toBeInTheDocument();
    expect(screen.getByText(/Rental history references are permissioned and operationally scoped/i)).toBeInTheDocument();
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText("View verification lineage")).toBeInTheDocument();
    expect(screen.getByText("View evidence lineage")).toBeInTheDocument();
    expect(screen.getByText("Raw government identity numbers are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden public/scoring actions", () => {
    render(
      <MemoryRouter>
        <VerifiedRentalHistoryPanel ledger={ledger} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Publish history")).not.toBeInTheDocument();
    expect(screen.queryByText("Report to bureau")).not.toBeInTheDocument();
    expect(screen.queryByText("Mint token")).not.toBeInTheDocument();
    expect(screen.queryByText("Public profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous verification")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve automatically")).not.toBeInTheDocument();
  });
});
