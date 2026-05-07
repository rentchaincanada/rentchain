import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { SupportOperationsProfile } from "@/api/supportOperationsApi";
import { SupportOperationsConsole } from "./SupportOperationsConsole";

const profile: SupportOperationsProfile = {
  supportOperationsId: "support_operations:production-support-operations-console-v1",
  status: "blocked",
  manualReviewRequired: true,
  autonomousSupportExecutionEnabled: false,
  adminImpersonationEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  supportReferences: [
    {
      referenceId: "support-1",
      referenceType: "support",
      status: "verified",
      label: "Support ticket lineage",
      description: "Support ticket lineage is visible as review-controlled operational metadata.",
      reviewRequired: true,
      lineageReferences: ["ticket-1"],
      destination: "/admin/support-console",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  onboardingReferences: [],
  credentialingReferences: [],
  incidentReferences: [],
  operationalRiskReferences: [
    {
      referenceId: "risk-1",
      referenceType: "operational_risk",
      status: "blocked",
      label: "Operational risk restriction",
      description: "Operational risk linkage is blocked for support operations review.",
      reviewRequired: true,
      lineageReferences: ["risk-1"],
      destination: "/operational-risk",
      redacted: false,
      redactionReason: null,
      blockedReason: "Operational risk remains unresolved.",
    },
  ],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  supportRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "operational_risk",
      status: "blocked",
      label: "Operational risk restriction",
      description: "Operational risk is unresolved for support operations readiness.",
      blockedReason: "Operational risk remains unresolved.",
    },
  ],
  redactions: ["Sensitive tenant, landlord, payment, screening, and provider credential payloads are excluded."],
  blockedReasons: ["Operational risk remains unresolved."],
  canonicalEvents: [],
};

describe("SupportOperationsConsole", () => {
  it("renders support status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <SupportOperationsConsole profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("View support readiness").length).toBeGreaterThan(0);
    expect(screen.getByText("View onboarding support")).toBeInTheDocument();
    expect(screen.getByText("View operational risk")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Operational risk remains unresolved.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Support and operations workflows are operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous operational intervention or unrestricted impersonation is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden support execution labels", () => {
    render(
      <MemoryRouter>
        <SupportOperationsConsole profile={profile} />
      </MemoryRouter>
    );

    const forbiddenLabels = [
      ["Auto", "resolve"],
      ["Autonomous", "intervention"],
      ["Impersonate", "user"],
      ["Override", "automatically"],
      ["Auto", "fix onboarding"],
      ["Hidden", "support action"],
    ].map((parts) => parts.join(parts[0] === "Auto" ? "-" : " "));

    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
