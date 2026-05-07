import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CourtDisputeLineageProfile } from "@/api/courtDisputeLineageApi";
import { CourtDisputeLineagePanel } from "./CourtDisputeLineagePanel";

const profile: CourtDisputeLineageProfile = {
  courtDisputeLineageId: "court_dispute_lineage:landlord-1:tenant-1",
  status: "blocked",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  legalFilingExecutionEnabled: false,
  collectionsExecutionEnabled: false,
  bureauReportingEnabled: false,
  publicCourtRecordExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  disputeReferences: [],
  courtRecordReferences: [
    {
      referenceId: "court-1",
      referenceType: "court_record",
      status: "blocked",
      label: "Court-record metadata reference",
      description: "Court-record reference metadata is available as operational court and dispute lineage metadata.",
      reviewRequired: true,
      lineageReferences: ["court-1"],
      destination: "/court-dispute-lineage",
      redacted: false,
      redactionReason: null,
      blockedReason: "Court-record metadata reference is blocked.",
    },
  ],
  filingReadinessReferences: [],
  judgmentOrderReferences: [],
  rentalDebtReferences: [],
  consentReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  courtDisputeRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "court_record",
      status: "blocked",
      label: "Court-record metadata reference restriction",
      description: "Court-record metadata reference is incomplete or blocked for court and dispute lineage review.",
      blockedReason: "Court-record metadata reference is blocked.",
    },
  ],
  redactions: ["Raw court documents, raw payment account details, private tenant data, raw screening or credit bureau payloads, and admin-only payloads are excluded."],
  blockedReasons: ["Court-record metadata reference is blocked."],
  canonicalEvents: [],
};

describe("CourtDisputeLineagePanel", () => {
  it("renders court/dispute status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <CourtDisputeLineagePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("View dispute lineage").length).toBeGreaterThan(0);
    expect(screen.getByText("View court reference")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Court-record metadata reference is blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Court and dispute lineage is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No legal filing, collections execution, bureau reporting, or public court-record exposure is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden court/dispute execution labels", () => {
    render(
      <MemoryRouter>
        <CourtDisputeLineagePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("File with court")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit legal filing")).not.toBeInTheDocument();
    expect(screen.queryByText("Send to collections")).not.toBeInTheDocument();
    expect(screen.queryByText("Report to bureau")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish court record")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous enforcement")).not.toBeInTheDocument();
  });
});
