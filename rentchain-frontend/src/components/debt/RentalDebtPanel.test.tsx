import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { RentalDebtProfile } from "@/api/rentalDebtApi";
import { RentalDebtPanel } from "./RentalDebtPanel";

const profile: RentalDebtProfile = {
  rentalDebtId: "rental_debt:landlord-1:tenant-1",
  status: "blocked",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  collectionsExecutionEnabled: false,
  bureauReportingEnabled: false,
  publicDebtExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  paymentDefaultReferences: [],
  delinquencyReferences: [],
  disputeReferences: [
    {
      referenceId: "dispute-1",
      referenceType: "dispute",
      status: "blocked",
      label: "Dispute linkage reference",
      description: "Dispute linkage metadata is available for rental debt accountability review.",
      reviewRequired: true,
      lineageReferences: ["dispute-1"],
      destination: "/review-timeline",
      redacted: false,
      redactionReason: null,
      blockedReason: "Dispute linkage is blocked.",
    },
  ],
  consentReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  debtRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "dispute",
      status: "blocked",
      label: "Dispute linkage reference restriction",
      description: "Dispute linkage reference is incomplete or blocked for rental debt accountability review.",
      blockedReason: "Dispute linkage is blocked.",
    },
  ],
  redactions: ["Raw payment account details, private tenant data, unrestricted delinquency histories, and raw screening or credit bureau payloads are excluded."],
  blockedReasons: ["Dispute linkage is blocked."],
  canonicalEvents: [],
};

describe("RentalDebtPanel", () => {
  it("renders accountability status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <RentalDebtPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View accountability profile")).toBeInTheDocument();
    expect(screen.getByText("View dispute lineage")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Dispute linkage is blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Rental debt accountability is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No collections execution, bureau reporting, or public debt exposure is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden debt execution labels", () => {
    render(
      <MemoryRouter>
        <RentalDebtPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Send to collections")).not.toBeInTheDocument();
    expect(screen.queryByText("Report to bureau")).not.toBeInTheDocument();
    expect(screen.queryByText("Public debt listing")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous enforcement")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-report debt")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish tenant debt")).not.toBeInTheDocument();
  });
});
