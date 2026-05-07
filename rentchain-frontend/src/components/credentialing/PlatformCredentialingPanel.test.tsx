import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { PlatformCredentialingReadiness } from "@/api/platformCredentialingApi";
import { PlatformCredentialingPanel } from "./PlatformCredentialingPanel";

const readiness: PlatformCredentialingReadiness = {
  platformCredentialingId: "platform_credentialing:institutional:v1",
  status: "blocked",
  manualApprovalRequired: true,
  consumerReportingExecutionEnabled: false,
  autonomousCredentialApprovalEnabled: false,
  publicCredentialExposureEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  governanceReferences: [],
  privacyReferences: [
    {
      referenceId: "privacy-1",
      referenceType: "privacy",
      status: "blocked",
      label: "Privacy posture reference",
      description: "Privacy posture metadata is available.",
      reviewRequired: true,
      lineageReferences: ["privacy-1"],
      destination: "/identity-layer",
      redacted: false,
      redactionReason: null,
      blockedReason: "Privacy or compliance posture is blocked.",
    },
  ],
  consentReferences: [],
  auditReferences: [],
  verificationReferences: [],
  interoperabilityReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  credentialingRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "privacy",
      status: "blocked",
      label: "Privacy posture reference restriction",
      description: "Privacy reference requires review.",
      blockedReason: "Privacy or compliance posture is blocked.",
    },
  ],
  redactions: ["Raw screening, credit bureau, government ID, tenant private document, payment account, and banking payloads are excluded."],
  blockedReasons: ["Privacy or compliance posture is blocked."],
  canonicalEvents: [],
};

describe("PlatformCredentialingPanel", () => {
  it("renders credentialing readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <PlatformCredentialingPanel readiness={readiness} />
      </MemoryRouter>
    );

    expect(screen.getByText("View credentialing readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Privacy or compliance posture is blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Platform credentialing readiness is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No consumer-reporting execution or autonomous credential approval is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden credentialing execution labels", () => {
    render(
      <MemoryRouter>
        <PlatformCredentialingPanel readiness={readiness} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Approve CRA access")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable bureau execution")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous onboarding")).not.toBeInTheDocument();
    expect(screen.queryByText("Public credential listing")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-approve credentials")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable consumer reporting")).not.toBeInTheDocument();
  });
});
