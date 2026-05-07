import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { PublicExposureHardeningProfile } from "@/api/publicExposureHardeningApi";
import { PublicExposureHardeningPanel } from "./PublicExposureHardeningPanel";

const profile: PublicExposureHardeningProfile = {
  publicExposureHardeningId: "public_exposure_hardening:controlled-production-exposure-readiness-v1",
  status: "blocked",
  manualApprovalRequired: true,
  autonomousLaunchEnabled: false,
  autonomousRollbackEnabled: false,
  publicExposureEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  releaseReferences: [],
  rollbackReferences: [],
  securityReferences: [],
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
      blockedReason: "Unresolved operational risk blocks public exposure readiness.",
    },
  ],
  onboardingReferences: [],
  supportReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  publicExposureRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "operational_risk",
      status: "blocked",
      label: "Operational risk dependency restriction",
      description: "Operational risk dependency is incomplete or blocked.",
      blockedReason: "Unresolved operational risk blocks public exposure readiness.",
    },
  ],
  redactions: ["Deployment credentials, tokens, secrets, and environment values are excluded."],
  blockedReasons: ["Unresolved operational risk blocks public exposure readiness."],
  canonicalEvents: [],
};

describe("PublicExposureHardeningPanel", () => {
  const forbiddenLabels = [
    ["Launch", "automatically"],
    ["Auto", "rollback"],
    ["Enable", "production"],
    ["Autonomous", "launch"],
    ["Auto", "approve launch"],
    ["Trigger", "production exposure"],
  ].map((parts) => (parts[0] === "Auto" ? parts.join("-") : parts.join(" ")));

  it("renders required safety copy, readiness status, restrictions, and blocked reasons", () => {
    render(
      <MemoryRouter>
        <PublicExposureHardeningPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View exposure readiness")).toBeInTheDocument();
    expect(screen.getByText(/Public exposure hardening is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous deployment, rollback, or public launch execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unresolved operational risk blocks public exposure readiness/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getByText("View operational risk")).toBeInTheDocument();
    expect(screen.getByText("Deployment credentials, tokens, secrets, and environment values are excluded.")).toBeInTheDocument();
  });

  it("omits forbidden public exposure execution labels", () => {
    render(
      <MemoryRouter>
        <PublicExposureHardeningPanel profile={profile} />
      </MemoryRouter>
    );

    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
