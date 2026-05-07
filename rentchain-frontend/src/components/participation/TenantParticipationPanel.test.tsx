import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TenantParticipationProfile } from "@/api/tenantParticipationApi";
import { TenantParticipationPanel } from "./TenantParticipationPanel";

const profile: TenantParticipationProfile = {
  tenantParticipationId: "tenant_participation:tenant-1",
  status: "blocked",
  tenantId: "tenant-1",
  manualReviewRequired: true,
  publicParticipationExposureEnabled: false,
  autonomousRewardExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  onboardingReferences: [
    {
      referenceId: "onboarding-1",
      referenceType: "onboarding",
      status: "blocked",
      label: "Onboarding participation reference",
      description: "Tenant onboarding participation metadata is available for participation review.",
      reviewRequired: true,
      lineageReferences: ["application-1"],
      destination: "/tenant/application",
      redacted: false,
      redactionReason: null,
      blockedReason: "Onboarding participation is blocked.",
    },
  ],
  paymentConsistencyReferences: [],
  occupancyReferences: [],
  maintenanceParticipationReferences: [],
  reviewParticipationReferences: [],
  disputeParticipationReferences: [],
  communicationParticipationReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  participationRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "onboarding",
      status: "blocked",
      label: "Onboarding participation reference restriction",
      description: "Onboarding participation reference is incomplete or blocked for tenant participation review.",
      blockedReason: "Onboarding participation is blocked.",
    },
  ],
  redactions: ["Raw payment account details, raw screening or credit bureau payloads, private tenant documents, and unrestricted audit histories are excluded."],
  blockedReasons: ["Onboarding participation is blocked."],
  canonicalEvents: [],
};

describe("TenantParticipationPanel", () => {
  it("renders participation readiness, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <TenantParticipationPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View participation profile")).toBeInTheDocument();
    expect(screen.getByText("View participation lineage")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Onboarding participation is blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Participation references are operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No public tenant scoring or autonomous incentives are enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden participation labels", () => {
    render(
      <MemoryRouter>
        <TenantParticipationPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Public tenant score")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-reward")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-penalize")).not.toBeInTheDocument();
    expect(screen.queryByText("Public ranking")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous incentive")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish participation score")).not.toBeInTheDocument();
  });
});
