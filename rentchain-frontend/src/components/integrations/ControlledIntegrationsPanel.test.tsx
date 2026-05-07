import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ControlledIntegrationProfile } from "@/api/controlledIntegrationsApi";
import { ControlledIntegrationsPanel } from "./ControlledIntegrationsPanel";

const profile: ControlledIntegrationProfile = {
  controlledIntegrationId: "controlled_integration:test:registry",
  integrationType: "registry",
  status: "blocked",
  manualApprovalRequired: true,
  liveSynchronizationEnabled: false,
  autonomousExecutionEnabled: false,
  webhookExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  adapterReferences: [
    {
      referenceId: "adapter-1",
      referenceType: "adapter",
      status: "verified",
      label: "Adapter readiness reference",
      description: "Adapter readiness is available.",
      reviewRequired: true,
      lineageReferences: ["adapter-1"],
      destination: "/interoperability-adapters",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  reviewReferences: [],
  evidenceReferences: [],
  settlementReferences: [],
  regulatoryReferences: [
    {
      referenceId: "regulatory-1",
      referenceType: "regulatory",
      status: "blocked",
      label: "Regulatory integration restriction reference",
      description: "Regulatory metadata is available.",
      reviewRequired: true,
      lineageReferences: ["regulatory-1"],
      destination: "/regulatory-profiles",
      redacted: false,
      redactionReason: null,
      blockedReason: "Regulatory readiness blocks controlled integration.",
    },
  ],
  observabilityReferences: [],
  releaseGovernanceReferences: [],
  auditReferences: [],
  integrationRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "regulatory",
      status: "blocked",
      label: "Regulatory integration restriction reference restriction",
      description: "Regulatory reference is incomplete.",
      blockedReason: "Regulatory readiness blocks controlled integration.",
    },
  ],
  redactions: ["Provider credentials, webhook secrets, API tokens, and integration execution payloads are excluded."],
  blockedReasons: ["Regulatory readiness blocks controlled integration."],
  canonicalEvents: [],
};

describe("ControlledIntegrationsPanel", () => {
  it("renders integration readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <ControlledIntegrationsPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View integration readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Regulatory readiness blocks controlled integration.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getByText(/Controlled integrations are operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous synchronization or unrestricted external execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual approval remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden integration execution labels", () => {
    render(
      <MemoryRouter>
        <ControlledIntegrationsPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Auto-sync/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Enable autonomous integration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execute integration automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Push data automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live webhook execution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Autonomous provider sync/i)).not.toBeInTheDocument();
  });
});
