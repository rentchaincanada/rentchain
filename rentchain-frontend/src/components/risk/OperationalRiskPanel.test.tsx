import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { OperationalRiskPanel } from "./OperationalRiskPanel";
import type { OperationalRiskProfile } from "@/api/operationalRiskApi";

const profile: OperationalRiskProfile = {
  operationalRiskId: "operational_risk:landlord-1:institution",
  riskScope: "institution",
  status: "attention_required",
  manualReviewRequired: true,
  autonomousRiskActionsEnabled: false,
  publicRiskExposureEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    lowSeverityReferences: 0,
    moderateSeverityReferences: 1,
    elevatedSeverityReferences: 1,
    criticalSeverityReferences: 0,
  },
  riskReferences: [],
  evidenceReferences: [
    {
      riskReferenceId: "evidence-1",
      riskType: "evidence_gap",
      status: "partially_verified",
      severity: "moderate",
      label: "Evidence gap visibility",
      description: "Evidence lineage is available.",
      reviewRequired: true,
      lineageReferences: ["evidence-1"],
      destination: "/evidence-packs",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  reviewReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  onboardingReferences: [],
  trustReferences: [],
  workflowReferences: [],
  delinquencyReferences: [],
  auditReferences: [],
  redactions: ["Sensitive tenant identity, screening, credit, payment account, and private document payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("OperationalRiskPanel", () => {
  it("renders safety copy, lineage, and status details", () => {
    render(
      <MemoryRouter>
        <OperationalRiskPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View operational risk")).toBeInTheDocument();
    expect(screen.getByText(/No underwriting, autonomous enforcement, or public risk exposure is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText("View evidence lineage")).toBeInTheDocument();
    expect(screen.getByText("Sensitive tenant identity, screening, credit, payment account, and private document payloads are excluded.")).toBeInTheDocument();
  });

  it("omits forbidden operational risk labels", () => {
    render(
      <MemoryRouter>
        <OperationalRiskPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Auto-enforce")).not.toBeInTheDocument();
    expect(screen.queryByText("Underwrite automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Public risk score")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous action")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve risk automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Public exposure")).not.toBeInTheDocument();
  });
});
