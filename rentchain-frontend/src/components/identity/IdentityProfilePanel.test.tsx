import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityProfilePanel } from "./IdentityProfilePanel";
import type { IdentityLayerProfile } from "@/api/identityLayerApi";

function profile(overrides: Partial<IdentityLayerProfile> = {}): IdentityLayerProfile {
  return {
    identityId: "tenant:tenant-1",
    identityType: "tenant",
    status: "verified",
    manualReviewRequired: true,
    publiclyShareable: false,
    externalInstitutionSharingEnabled: false,
    tokenizationEnabled: false,
    verificationSummary: {
      totalReferences: 2,
      verifiedReferences: 2,
      missingReferences: 0,
      blockedReferences: 0,
    },
    consentSummary: {
      consentAvailable: true,
      consentScope: ["screening consent"],
      consentReferences: 1,
      missingConsentReasons: [],
    },
    portabilitySummary: {
      portableReferenceAvailable: true,
      portabilityStatus: "ready",
      blockedReasons: [],
    },
    trustState: {
      subjectType: "tenant",
      subjectId: "tenant:tenant-1",
      trustLevel: "platform_correlated",
      trustLabel: "Platform-correlated signals present",
      trustDescription: "Multiple RentChain operational records align, but they should not be treated as government-grade identity proof.",
      manualReviewRequired: true,
      providerIntegrationEnabled: false,
      rawSensitivePayloadStored: false,
      executionEligible: false,
      externalSharingRequiresConsent: true,
      signalSummary: {
        totalSignals: 2,
        assertedSignals: 0,
        pendingSignals: 0,
        verifiedSignals: 2,
        providerAttestedSignals: 0,
        expiredSignals: 0,
        revokedSignals: 0,
        reviewRequiredSignals: 0,
      },
      activeSignals: [],
      missingSignals: ["identity"],
      reviewReasons: [],
      redactions: ["Trust state stores metadata-only verification signals."],
      canonicalEvents: [],
      generatedAt: "2026-05-06T00:00:00.000Z",
    },
    identityAssurance: {
      subjectType: "tenant",
      subjectId: "tenant:tenant-1",
      status: "not_started",
      level: "not_assessed",
      lifecycleState: "not_started",
      assuranceLabel: "Identity assurance not started",
      assuranceDescription: "No provider-neutral identity assurance attestation is present. Existing onboarding remains unblocked.",
      providerCategory: "none",
      consentRequired: true,
      consentAvailable: false,
      retentionClass: "assurance_metadata",
      metadataOnly: true,
      rawSensitivePayloadStored: false,
      providerIntegrationEnabled: false,
      onboardingBlocking: false,
      publicShareable: false,
      executionEligible: false,
      reverificationRequired: false,
      nextReverificationAt: null,
      signalSummary: {
        totalAttestations: 0,
        completedAttestations: 0,
        pendingAttestations: 0,
        failedAttestations: 0,
        expiredAttestations: 0,
        revokedAttestations: 0,
        reviewRequiredAttestations: 0,
      },
      supportSummary: {
        visibleToSupport: true,
        rawProviderPayloadVisible: false,
        rawIdentityDocumentVisible: false,
        biometricPayloadVisible: false,
        identityDocumentNumberVisible: false,
        attestations: [],
      },
      redactions: [],
      reviewReasons: [],
      canonicalEvents: [],
      generatedAt: "2026-05-06T00:00:00.000Z",
    },
    propertyTrust: {
      subjectType: "landlord",
      subjectId: "tenant:tenant-1",
      propertyId: null,
      accountId: null,
      businessId: null,
      businessStatus: "not_started",
      propertyStatus: "not_started",
      operatorAuthorityStatus: "not_asserted",
      registryLinkStatus: "not_linked",
      relationshipType: "none",
      authorityConfidence: "none",
      trustLabel: "Property authority not verified",
      trustDescription: "No provider-neutral business, property, or operator authority attestation is present. Onboarding remains unblocked.",
      providerCategory: "none",
      consentRequired: true,
      consentAvailable: false,
      retentionClass: "authority_metadata",
      metadataOnly: true,
      rawSensitivePayloadStored: false,
      liveRegistryIntegrationEnabled: false,
      onboardingBlocking: false,
      publicShareable: false,
      executionEligible: false,
      legalOwnershipConclusion: false,
      reverificationRequired: false,
      nextReverificationAt: null,
      signalSummary: {
        totalAttestations: 0,
        businessCompletedAttestations: 0,
        propertyCompletedAttestations: 0,
        operatorAuthorityAttestations: 0,
        registryLinkedAttestations: 0,
        expiredAttestations: 0,
        revokedAttestations: 0,
        reviewRequiredAttestations: 0,
      },
      supportSummary: {
        visibleToSupport: true,
        rawTitleDocumentVisible: false,
        rawRegistryPayloadVisible: false,
        rawBankingPayloadVisible: false,
        legalOwnershipConclusionVisible: false,
        attestations: [],
      },
      redactions: [],
      reviewReasons: [],
      canonicalEvents: [],
      generatedAt: "2026-05-06T00:00:00.000Z",
    },
    lineageReferences: [],
    verificationReferences: [
      {
        referenceId: "tenant-1",
        referenceType: "tenant_profile",
        label: "Tenant profile reference",
        status: "available",
        destination: "/tenants",
        occurredAt: null,
        redacted: false,
        blockedReason: null,
      },
    ],
    consentReferences: [
      {
        referenceId: "consent-1",
        referenceType: "consent",
        label: "screening consent",
        status: "available",
        destination: null,
        occurredAt: null,
        redacted: false,
        blockedReason: null,
      },
    ],
    reviewReferences: [],
    redactions: ["Raw screening and credit bureau payloads are excluded."],
    blockedReasons: [],
    canonicalEvents: [],
    generatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("IdentityProfilePanel", () => {
  afterEach(() => cleanup());

  it("renders identity status, lineage, redactions, and required safety copy", () => {
    render(
      <MemoryRouter>
        <IdentityProfilePanel profile={profile()} />
      </MemoryRouter>
    );

    expect(screen.getByText("View identity profile")).toBeInTheDocument();
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
    expect(screen.getByText(/Identity references are permissioned and operationally scoped/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review remains required/i)).toBeInTheDocument();
    expect(screen.getByText(/No public identity sharing or tokenization is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("View verification lineage")).toBeInTheDocument();
    expect(screen.getByText("Account trust state")).toBeInTheDocument();
    expect(screen.getByText("Platform-correlated signals present")).toBeInTheDocument();
    expect(screen.getByText("Business and property authority")).toBeInTheDocument();
    expect(screen.getByText("Property authority not verified")).toBeInTheDocument();
    expect(screen.getByText("No ownership conclusion")).toBeInTheDocument();
    expect(screen.getByText("Execution disabled")).toBeInTheDocument();
    expect(screen.getByText("Metadata only")).toBeInTheDocument();
    expect(screen.getByText("Tenant profile reference")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/tenants");
    expect(screen.getByText("View consent lineage")).toBeInTheDocument();
    expect(screen.getByText("screening consent")).toBeInTheDocument();
    expect(screen.getByText("Raw screening and credit bureau payloads are excluded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish identity|share publicly|mint token|export identity publicly|autonomous verification|approve identity automatically/i })).not.toBeInTheDocument();
  });

  it("renders graceful missing context and blocked reasons", () => {
    render(
      <MemoryRouter>
        <IdentityProfilePanel
          profile={profile({
            status: "review_required",
            consentReferences: [],
            reviewReferences: [],
            portabilitySummary: {
              portableReferenceAvailable: false,
              portabilityStatus: "not_ready",
              blockedReasons: ["Identity portability requires verified references."],
            },
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Context unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText(/View blocked reason: Identity portability requires verified references\./i)).toBeInTheDocument();
  });
});
