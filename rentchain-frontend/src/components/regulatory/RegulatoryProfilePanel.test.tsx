import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RegulatoryProfilePanel } from "./RegulatoryProfilePanel";

const profile = {
  regulatoryProfileId: "regulatory_profile:landlord-1:ca:ns:halifax",
  jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
  status: "partially_ready",
  manualReviewRequired: true,
  legalCertificationEnabled: false,
  externalRegulatorSubmissionEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 3,
    verifiedReferences: 1,
    partiallyReadyReferences: 1,
    blockedReferences: 1,
    unavailableReferences: 0,
    restrictions: 2,
  },
  registryReferences: [
    {
      referenceId: "regulatory:registry:property-1",
      referenceType: "registry",
      status: "partially_verified",
      label: "Registry readiness reference",
      description: "Property registry metadata is available for jurisdiction-aware review.",
      jurisdictionScope: { country: "CA", province: "NS", municipality: "Halifax" },
      restrictionSummary: { restricted: true, reasons: ["Registry verification is incomplete or unavailable."] },
      reviewLineage: [],
      evidenceLineage: ["evidence-1"],
      destination: "/properties?propertyId=property-1",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
    },
  ],
  screeningReadiness: [],
  privacyReadiness: [
    {
      referenceId: "regulatory:privacy:none",
      referenceType: "privacy",
      status: "blocked",
      label: "Privacy and consent readiness",
      description: "Consent lineage is required before regulated sharing review.",
      jurisdictionScope: { country: "CA", province: "NS", municipality: "Halifax" },
      restrictionSummary: { restricted: true, reasons: ["Consent lineage is missing."] },
      reviewLineage: [],
      evidenceLineage: [],
      destination: null,
      redacted: false,
      redactionReason: null,
      blockedReason: "Consent/access lineage is required for regulatory profile readiness.",
    },
  ],
  sharingRestrictions: [],
  settlementRestrictions: [],
  exportRestrictions: [],
  auditReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  redactions: ["Government filing payloads are excluded."],
  blockedReasons: ["Consent/access lineage is required for regulatory profile readiness."],
  canonicalEvents: [],
} as const;

describe("RegulatoryProfilePanel", () => {
  it("renders regulatory readiness, restrictions, lineage, and required safety copy", () => {
    render(
      <MemoryRouter>
        <RegulatoryProfilePanel profile={profile as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View regulatory profile")).toBeInTheDocument();
    expect(screen.getAllByText(/No legal certification or regulator submission is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("View restrictions: Registry verification is incomplete or unavailable.")).toBeInTheDocument();
    expect(screen.getByText("View blocked reason: Consent/access lineage is required for regulatory profile readiness.")).toBeInTheDocument();
    expect(screen.getByText("Government filing payloads are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden regulatory action labels", () => {
    render(
      <MemoryRouter>
        <RegulatoryProfilePanel profile={profile as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Certify compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit to regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-file")).not.toBeInTheDocument();
    expect(screen.queryByText("Legal approval")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish compliance")).not.toBeInTheDocument();
  });
});
