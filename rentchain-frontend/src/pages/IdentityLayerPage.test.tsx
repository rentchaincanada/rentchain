import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentityLayerPage from "./IdentityLayerPage";

const apiMocks = vi.hoisted(() => ({
  fetchIdentityLayerProfile: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/identityLayerApi", async () => {
  const actual = await vi.importActual<any>("@/api/identityLayerApi");
  return {
    ...actual,
    fetchIdentityLayerProfile: apiMocks.fetchIdentityLayerProfile,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function profile() {
  return {
    identityId: "tenant:tenant-1",
    identityType: "tenant",
    status: "partially_verified",
    manualReviewRequired: true,
    publiclyShareable: false,
    externalInstitutionSharingEnabled: false,
    tokenizationEnabled: false,
    verificationSummary: {
      totalReferences: 2,
      verifiedReferences: 1,
      missingReferences: 1,
      blockedReferences: 0,
    },
    consentSummary: {
      consentAvailable: false,
      consentScope: [],
      consentReferences: 0,
      missingConsentReasons: ["Consent lineage reference is missing."],
    },
    portabilitySummary: {
      portableReferenceAvailable: true,
      portabilityStatus: "limited",
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
      redactions: ["Raw provider identity payloads are excluded."],
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
    consentReferences: [],
    reviewReferences: [],
    redactions: ["Payment account details are excluded."],
    blockedReasons: [],
    canonicalEvents: [],
    generatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("IdentityLayerPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    apiMocks.fetchIdentityLayerProfile.mockResolvedValue(profile());
  });

  it("renders identity profile, filters, and required safety copy", async () => {
    render(
      <MemoryRouter initialEntries={["/identity-layer?identityType=tenant&identityId=tenant-1"]}>
        <IdentityLayerPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Identity layer" })).toBeInTheDocument();
    expect(screen.getAllByText(/Identity references are permissioned and operationally scoped/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No public identity sharing or tokenization is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("tenant")).toBeInTheDocument();
    expect(screen.getByDisplayValue("tenant-1")).toBeInTheDocument();
    expect(screen.getByText("View verification lineage")).toBeInTheDocument();
    expect(screen.getByText("Account trust state")).toBeInTheDocument();
    expect(screen.getByText("Identity assurance")).toBeInTheDocument();
    expect(screen.getByText("Identity assurance not started")).toBeInTheDocument();
    expect(screen.getByText("Business and property authority")).toBeInTheDocument();
    expect(screen.getByText("No ownership conclusion")).toBeInTheDocument();
    expect(screen.getByText("Onboarding unblocked")).toBeInTheDocument();
    expect(screen.getByText("Payment account details are excluded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish identity|share publicly|mint token|export identity publicly|autonomous verification|approve identity automatically/i })).not.toBeInTheDocument();
    expect(apiMocks.fetchIdentityLayerProfile).toHaveBeenCalledWith({ identityType: "tenant", identityId: "tenant-1" });
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("renders load errors safely", async () => {
    apiMocks.fetchIdentityLayerProfile.mockRejectedValue(new Error("network unavailable"));

    render(
      <MemoryRouter>
        <IdentityLayerPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/We couldn't load identity layer profile right now\./i)).toBeInTheDocument();
    expect(apiMocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });
});
