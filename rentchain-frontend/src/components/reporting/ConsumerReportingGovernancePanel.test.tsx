import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ConsumerReportingGovernanceProfile } from "@/api/consumerReportingGovernanceApi";
import { ConsumerReportingGovernancePanel } from "./ConsumerReportingGovernancePanel";

const profile: ConsumerReportingGovernanceProfile = {
  consumerReportingGovernanceId: "consumer_reporting_governance:institutional:v1",
  status: "blocked",
  manualApprovalRequired: true,
  consumerReportingExecutionEnabled: false,
  autonomousReportingEnabled: false,
  publicReportingExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  consentReferences: [
    {
      referenceId: "consent-1",
      referenceType: "consent",
      status: "blocked",
      label: "Consent governance reference",
      description: "Consent metadata is available.",
      reviewRequired: true,
      lineageReferences: ["consent-1"],
      destination: "/identity-layer",
      redacted: false,
      redactionReason: null,
      blockedReason: "Consent lineage is missing or blocked.",
    },
  ],
  disputeReferences: [],
  adverseActionReferences: [],
  credentialingReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  reportingRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "consent",
      status: "blocked",
      label: "Consent governance reference restriction",
      description: "Consent reference requires governance review.",
      blockedReason: "Consent lineage is missing or blocked.",
    },
  ],
  redactions: ["Raw screening, credit bureau, government ID, tenant private document, payment account, and banking payloads are excluded."],
  blockedReasons: ["Consent lineage is missing or blocked."],
  canonicalEvents: [],
};

describe("ConsumerReportingGovernancePanel", () => {
  it("renders reporting governance readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <ConsumerReportingGovernancePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View governance readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Consent lineage is missing or blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Consumer reporting governance is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No bureau execution or autonomous reporting is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual approval remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden reporting execution labels", () => {
    render(
      <MemoryRouter>
        <ConsumerReportingGovernancePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Report to bureau")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-report")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute collections")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous reporting")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish tenant score")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable CRA operations")).not.toBeInTheDocument();
  });
});
