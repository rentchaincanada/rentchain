import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { OnboardingHardeningProfile } from "@/api/onboardingHardeningApi";
import { OnboardingHardeningPanel } from "./OnboardingHardeningPanel";

const profile: OnboardingHardeningProfile = {
  onboardingHardeningId: "onboarding_hardening:tenant:tenant-1",
  participantType: "tenant",
  participantId: "tenant-1",
  status: "blocked",
  manualReviewRequired: true,
  autonomousOnboardingEnabled: false,
  autonomousScreeningActivationEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  completionReferences: [],
  profileReferences: [
    {
      referenceId: "profile-1",
      referenceType: "profile",
      status: "blocked",
      label: "Profile readiness reference",
      description: "Tenant profile completeness lineage is available as operational onboarding hardening metadata.",
      reviewRequired: true,
      lineageReferences: ["profile-1"],
      destination: "/tenant/profile",
      redacted: false,
      redactionReason: null,
      blockedReason: "Profile readiness lineage is blocked.",
    },
  ],
  screeningReadinessReferences: [],
  integrationReadinessReferences: [],
  frictionReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  onboardingRestrictions: [
    {
      restrictionId: "restriction-1",
      restrictionType: "profile",
      status: "blocked",
      label: "Profile readiness reference restriction",
      description: "Profile readiness reference is incomplete or blocked for onboarding hardening review.",
      blockedReason: "Profile readiness lineage is blocked.",
    },
  ],
  redactions: ["Tenant sensitive onboarding payloads are excluded."],
  blockedReasons: ["Profile readiness lineage is blocked."],
  canonicalEvents: [],
};

describe("OnboardingHardeningPanel", () => {
  it("renders onboarding status, restrictions, blocked reasons, and required safety copy", () => {
    render(
      <MemoryRouter>
        <OnboardingHardeningPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.getByText("View onboarding readiness")).toBeInTheDocument();
    expect(screen.getByText("View profile readiness")).toBeInTheDocument();
    expect(screen.getByText("View screening readiness")).toBeInTheDocument();
    expect(screen.getByText("View restrictions")).toBeInTheDocument();
    expect(screen.getAllByText("View blocked reason: Profile readiness lineage is blocked.").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText(/Onboarding readiness is operationally scoped and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/No autonomous onboarding or screening activation is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
  });

  it("does not render forbidden onboarding execution labels", () => {
    render(
      <MemoryRouter>
        <OnboardingHardeningPanel profile={profile} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Auto-onboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-activate screening")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous onboarding")).not.toBeInTheDocument();
    expect(screen.queryByText("Skip verification automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-enable integrations")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish onboarding profile")).not.toBeInTheDocument();
  });
});
