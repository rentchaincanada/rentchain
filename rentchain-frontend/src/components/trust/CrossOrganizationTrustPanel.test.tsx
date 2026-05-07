import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CrossOrganizationTrustPanel } from "./CrossOrganizationTrustPanel";

const reference = {
  trustReferenceId: "trust:evidence:evidence-1",
  referenceType: "evidence",
  status: "verified",
  label: "Evidence trust lineage",
  description: "Evidence pack lineage is available for operational trust review.",
  reviewRequired: true,
  lineageReferences: ["evidence-1"],
  destination: "/evidence-packs",
  redacted: false,
  redactionReason: null,
  blockedReason: null,
};

const trustRelationship = {
  trustRelationshipId: "cross_organization_trust:landlord-1:operational_trust",
  relationshipType: "operational_trust",
  status: "review_required",
  manualReviewRequired: true,
  publicTrustExposureEnabled: false,
  autonomousTrustApprovalEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 2,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 1,
  },
  participantReferences: ["participant-1"],
  reviewReferences: [{ ...reference, trustReferenceId: "trust:review:review-1", referenceType: "review", label: "Review trust lineage" }],
  evidenceReferences: [reference],
  settlementReferences: [],
  regulatoryReferences: [],
  sharingReferences: [],
  auditReferences: [],
  operationalReferences: [],
  trustRestrictions: [
    {
      restrictionId: "trust:consent:missing",
      restrictionType: "consent",
      status: "blocked",
      label: "Consent/access lineage missing",
      description: "Permissioned trust requires consent or access lineage before relying on the relationship.",
      blockedReason: "Consent/access lineage is missing.",
    },
  ],
  redactions: ["Raw government identifiers, screening, and credit bureau payloads are excluded."],
  blockedReasons: ["Consent/access lineage is missing."],
  canonicalEvents: [],
} as const;

describe("CrossOrganizationTrustPanel", () => {
  it("renders trust lineage, restrictions, redactions, and required safety copy", () => {
    render(
      <MemoryRouter>
        <CrossOrganizationTrustPanel trustRelationship={trustRelationship as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View trust relationship")).toBeInTheDocument();
    expect(screen.getAllByText(/No public trust exposure or autonomous trust approval is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View blocked reason: Consent/access lineage is missing.")).toBeInTheDocument();
    expect(screen.getByText("Raw government identifiers, screening, and credit bureau payloads are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden trust action labels", () => {
    render(
      <MemoryRouter>
        <CrossOrganizationTrustPanel trustRelationship={trustRelationship as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Public trust score")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-approve trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Public ranking")).not.toBeInTheDocument();
    expect(screen.queryByText("Reputation marketplace")).not.toBeInTheDocument();
  });
});
