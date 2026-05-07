import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { EnterpriseMunicipalReadinessProfile } from "@/api/enterpriseMunicipalReadinessApi";
import { EnterpriseMunicipalReadinessPanel } from "./EnterpriseMunicipalReadinessPanel";

const profile: EnterpriseMunicipalReadinessProfile = {
  enterpriseMunicipalReadinessId: "enterprise_municipal:municipality:municipality",
  organizationType: "municipality",
  status: "blocked",
  manualApprovalRequired: true,
  autonomousGovernmentExecutionEnabled: false,
  autonomousEnterpriseExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  institutionalReferences: [
    {
      referenceId: "institutional-1",
      referenceType: "institutional",
      status: "verified",
      label: "Institutional onboarding reference",
      description: "Institutional onboarding readiness is available as review metadata.",
      reviewRequired: true,
      lineageReferences: ["institutional-1"],
      destination: "/institution-onboarding-readiness",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  portfolioGovernanceReferences: [],
  municipalReadinessReferences: [],
  regulatoryReferences: [],
  operationalRiskReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  enterpriseRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "operational_risk",
      status: "blocked",
      label: "Operational risk enterprise restriction",
      description: "Unresolved operational risk blocks enterprise readiness.",
      blockedReason: "Unresolved operational risk blocks enterprise readiness.",
    },
  ],
  redactions: ["Sensitive tenant, payment, screening, credential, and public-sector execution payloads are excluded."],
  blockedReasons: ["Unresolved operational risk blocks enterprise readiness."],
  canonicalEvents: [],
};

describe("EnterpriseMunicipalReadinessPanel", () => {
  it("renders readiness status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <EnterpriseMunicipalReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View readiness")).toBeInTheDocument();
    expect(screen.getByText("View institutional references")).toBeInTheDocument();
    expect(screen.getByText("View operational risk")).toBeInTheDocument();
    expect(screen.getByText("View review lineage")).toBeInTheDocument();
    expect(screen.getByText("View evidence lineage")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getByText("View blocked reason: Unresolved operational risk blocks enterprise readiness.")).toBeInTheDocument();
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Enterprise and municipal readiness is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous government or enterprise execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden enterprise execution labels", () => {
    render(
      <MemoryRouter>
        <EnterpriseMunicipalReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    const forbiddenLabels = [
      ["Submit to", "municipality"],
      ["Auto", "submit CMHC"],
      ["Autonomous", "onboarding"],
      ["Enable government", "execution"],
      ["Auto", "approve enterprise"],
      ["Trigger institutional", "rollout"],
    ].map((parts) => parts.join(parts[0] === "Auto" ? "-" : " "));

    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
