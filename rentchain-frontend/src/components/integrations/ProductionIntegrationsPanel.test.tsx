import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ProductionIntegrationProfile } from "@/api/productionIntegrationsApi";
import { ProductionIntegrationsPanel } from "./ProductionIntegrationsPanel";

const profile: ProductionIntegrationProfile = {
  productionIntegrationId: "production_integration:registry-production:registry",
  integrationType: "registry",
  status: "blocked",
  manualApprovalRequired: true,
  autonomousExecutionEnabled: false,
  paymentExecutionEnabled: false,
  unrestrictedWebhookExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  activationReferences: [],
  observabilityReferences: [
    {
      referenceId: "observability-1",
      referenceType: "observability",
      status: "verified",
      label: "Integration observability reference",
      description: "Observability readiness is available as supervised production integration metadata.",
      reviewRequired: true,
      lineageReferences: ["observability-1"],
      destination: "/admin/observability-incident-readiness",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  rollbackReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  governanceReferences: [],
  auditReferences: [],
  integrationRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "operational_risk",
      status: "blocked",
      label: "Operational risk production integration restriction",
      description: "Unresolved operational risk blocks production integration readiness.",
      blockedReason: "Unresolved operational risk blocks production integration readiness.",
    },
  ],
  redactions: ["Provider credentials, webhook secrets, API tokens, and execution payloads are excluded."],
  blockedReasons: ["Unresolved operational risk blocks production integration readiness."],
  canonicalEvents: [],
};

describe("ProductionIntegrationsPanel", () => {
  it("renders readiness status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <ProductionIntegrationsPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("View production readiness").length).toBeGreaterThan(0);
    expect(screen.getByText("View observability readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getByText("View blocked reason: Unresolved operational risk blocks production integration readiness.")).toBeInTheDocument();
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getByText(/Production integrations are operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous synchronization or unrestricted external execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual approval remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden production integration execution labels", () => {
    render(
      <MemoryRouter>
        <ProductionIntegrationsPanel profile={profile} />
      </MemoryRouter>
    );

    const forbiddenLabels = [
      ["Auto", "sync"],
      ["Autonomous", "integration"],
      ["Execute provider", "automatically"],
      ["Enable unrestricted", "webhooks"],
      ["Trigger", "settlement"],
      ["Autonomous production", "activation"],
    ].map((parts) => parts.join(parts[0] === "Auto" ? "-" : " "));

    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
