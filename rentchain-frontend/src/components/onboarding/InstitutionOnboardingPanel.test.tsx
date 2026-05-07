import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { InstitutionOnboardingPanel } from "./InstitutionOnboardingPanel";

const reference = {
  referenceId: "onboarding:evidence:evidence-1",
  referenceType: "evidence",
  status: "verified",
  label: "Evidence readiness lineage",
  description: "Evidence pack lineage is available for institution onboarding readiness.",
  reviewRequired: true,
  lineageReferences: ["evidence-1"],
  destination: "/evidence-packs",
  redacted: false,
  redactionReason: null,
  blockedReason: null,
};

const readiness = {
  onboardingReadinessId: "institution_onboarding_readiness:landlord-1:lender",
  institutionType: "lender",
  status: "review_required",
  manualReviewRequired: true,
  externalOnboardingEnabled: false,
  autonomousApprovalEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
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
  identityReferences: [],
  evidenceReferences: [reference],
  reviewReferences: [{ ...reference, referenceId: "onboarding:review:review-1", referenceType: "review", label: "Review readiness lineage" }],
  settlementReferences: [],
  regulatoryReferences: [],
  sharingReferences: [],
  auditReferences: [],
  onboardingRestrictions: [
    {
      restrictionId: "onboarding:consent:missing",
      restrictionType: "consent",
      status: "blocked",
      label: "Consent/access lineage missing",
      description: "Institution onboarding readiness requires consent or access lineage before operational reliance.",
      blockedReason: "Consent/access lineage is missing.",
    },
  ],
  redactions: ["Raw government identifiers, screening, and credit bureau payloads are excluded."],
  blockedReasons: ["Consent/access lineage is missing."],
  canonicalEvents: [],
} as const;

describe("InstitutionOnboardingPanel", () => {
  it("renders onboarding lineage, restrictions, redactions, and required safety copy", () => {
    render(
      <MemoryRouter>
        <InstitutionOnboardingPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View onboarding readiness")).toBeInTheDocument();
    expect(screen.getAllByText(/No live institution integration or autonomous onboarding is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View blocked reason: Consent/access lineage is missing.")).toBeInTheDocument();
    expect(screen.getByText("Raw government identifiers, screening, and credit bureau payloads are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden onboarding action labels", () => {
    render(
      <MemoryRouter>
        <InstitutionOnboardingPanel readiness={readiness as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Connect lender")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-onboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit onboarding")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous approval")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish onboarding")).not.toBeInTheDocument();
  });
});
