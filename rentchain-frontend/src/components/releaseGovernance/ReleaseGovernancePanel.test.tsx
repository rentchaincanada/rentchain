import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ReleaseGovernanceProfile } from "@/api/releaseGovernanceApi";
import { ReleaseGovernancePanel } from "./ReleaseGovernancePanel";

const profile: ReleaseGovernanceProfile = {
  releaseGovernanceId: "release_governance:v0.9.0-core-foundation",
  releaseVersion: "v0.9.0-core-foundation",
  status: "partially_ready",
  manualApprovalRequired: true,
  autonomousDeploymentEnabled: false,
  autonomousRollbackEnabled: false,
  publicLaunchEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 1,
  },
  releaseReferences: [],
  deploymentReferences: [],
  rollbackReferences: [],
  qaReferences: [
    {
      referenceId: "qa-1",
      referenceType: "qa",
      status: "partially_verified",
      label: "QA verification reference",
      description: "QA verification metadata is available.",
      reviewRequired: true,
      lineageReferences: ["qa-1"],
      destination: null,
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  operationalRiskReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  auditReferences: [],
  releaseRestrictions: [],
  redactions: ["Deployment credentials, tokens, secrets, and environment values are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ReleaseGovernancePanel", () => {
  it("renders required safety copy and release governance lineage", () => {
    render(
      <MemoryRouter>
        <ReleaseGovernancePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View release readiness")).toBeInTheDocument();
    expect(screen.getByText(/No autonomous deployment, rollback, or public launch execution is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getByText("View QA verification")).toBeInTheDocument();
    expect(screen.getByText("Deployment credentials, tokens, secrets, and environment values are excluded.")).toBeInTheDocument();
  });

  it("omits forbidden release execution labels", () => {
    render(
      <MemoryRouter>
        <ReleaseGovernancePanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Deploy automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-rollback")).not.toBeInTheDocument();
    expect(screen.queryByText("Public launch")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous deployment")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-approve release")).not.toBeInTheDocument();
    expect(screen.queryByText("Trigger production deploy")).not.toBeInTheDocument();
  });
});
