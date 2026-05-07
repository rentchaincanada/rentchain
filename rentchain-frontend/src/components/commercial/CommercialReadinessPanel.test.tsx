import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CommercialReadinessProfile } from "@/api/commercialReadinessApi";
import { CommercialReadinessPanel } from "./CommercialReadinessPanel";

const profile: CommercialReadinessProfile = {
  commercialReadinessId: "commercial_readiness:test",
  status: "blocked",
  manualApprovalRequired: true,
  autonomousBillingEnabled: false,
  autonomousCommercializationEnabled: false,
  publicSelfServiceEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  pricingReferences: [
    {
      referenceId: "pricing-1",
      referenceType: "pricing",
      status: "verified",
      label: "Pricing governance reference",
      description: "Pricing governance metadata is available.",
      reviewRequired: true,
      lineageReferences: ["pricing-1"],
      destination: "/site/pricing",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  billingReferences: [],
  subscriptionReferences: [],
  onboardingReferences: [],
  supportReferences: [],
  operationalRiskReferences: [
    {
      referenceId: "risk-1",
      referenceType: "operational_risk",
      status: "blocked",
      label: "Operational risk dependency",
      description: "Operational risk readiness is available.",
      reviewRequired: true,
      lineageReferences: ["risk-1"],
      destination: "/operational-risk",
      redacted: false,
      redactionReason: null,
      blockedReason: "Unresolved operational risk blocks commercial readiness.",
    },
  ],
  releaseReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  commercialRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "operational_risk",
      status: "blocked",
      label: "Operational risk dependency restriction",
      description: "Operational risk dependency is incomplete.",
      blockedReason: "Unresolved operational risk blocks commercial readiness.",
    },
  ],
  redactions: ["Payment credentials and subscription secrets are excluded."],
  blockedReasons: ["Unresolved operational risk blocks commercial readiness."],
  canonicalEvents: [],
};

describe("CommercialReadinessPanel", () => {
  it("renders readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <CommercialReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("Commercial readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Unresolved operational risk blocks commercial readiness.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getByText(/Commercial readiness is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous billing, charging, or commercialization execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual approval remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden commercial execution labels", () => {
    render(
      <MemoryRouter>
        <CommercialReadinessPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Charge automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto-subscribe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Enable monetization/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous billing")).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto-approve customer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Trigger commercial rollout/i)).not.toBeInTheDocument();
  });
});
