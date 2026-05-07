import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { EcosystemCoordinationSnapshot } from "@/api/ecosystemCoordinationApi";
import { EcosystemCoordinationConsole } from "./EcosystemCoordinationConsole";

const snapshot: EcosystemCoordinationSnapshot = {
  ecosystemCoordinationId: "ecosystem_coordination:institutional:v1",
  status: "blocked",
  manualReviewRequired: true,
  autonomousCoordinationEnabled: false,
  externalExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  participantReferences: [],
  trustReferences: [],
  onboardingReferences: [],
  riskReferences: [
    {
      referenceId: "risk-1",
      referenceType: "risk",
      status: "blocked",
      label: "Operational risk reference",
      description: "Operational risk metadata is available.",
      reviewRequired: true,
      lineageReferences: ["risk-1"],
      destination: "/operational-risk",
      redacted: false,
      redactionReason: null,
      blockedReason: "Operational risk blocks ecosystem coordination.",
    },
  ],
  integrationReferences: [
    {
      referenceId: "integration-1",
      referenceType: "integration",
      status: "verified",
      label: "Controlled integration reference",
      description: "Controlled integration metadata is available.",
      reviewRequired: true,
      lineageReferences: ["integration-1"],
      destination: "/admin/controlled-integrations",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  settlementReferences: [],
  regulatoryReferences: [],
  observabilityReferences: [],
  governanceReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  auditReferences: [],
  ecosystemRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "risk",
      status: "blocked",
      label: "Operational risk reference restriction",
      description: "Risk reference requires governance attention.",
      blockedReason: "Operational risk blocks ecosystem coordination.",
    },
  ],
  redactions: [
    "Private tenant data, raw government IDs, payment payloads, banking payloads, and settlement execution payloads are excluded.",
  ],
  blockedReasons: ["Operational risk blocks ecosystem coordination."],
  canonicalEvents: [],
};

describe("EcosystemCoordinationConsole", () => {
  it("renders coordination readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <EcosystemCoordinationConsole snapshot={snapshot} />
      </MemoryRouter>
    );

    expect(screen.getByText("View ecosystem coordination")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Operational risk blocks ecosystem coordination.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Ecosystem coordination is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous orchestration or external execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden ecosystem execution labels", () => {
    render(
      <MemoryRouter>
        <EcosystemCoordinationConsole snapshot={snapshot} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Auto-coordinate")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous orchestration")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute integrations")).not.toBeInTheDocument();
    expect(screen.queryByText("Trigger deployment")).not.toBeInTheDocument();
    expect(screen.queryByText("Trigger onboarding")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute ecosystem actions")).not.toBeInTheDocument();
  });
});
