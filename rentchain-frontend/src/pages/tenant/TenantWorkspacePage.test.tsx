import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantWorkspacePage from "./TenantWorkspacePage";
import TenantApplicationStatusPage from "./TenantApplicationStatusPage";
import TenantLeasePage from "./TenantLeasePage";
import TenantMaintenanceRequestsPage from "./TenantMaintenanceRequestsPage";
import TenantInviteRedeemPage from "./TenantInviteRedeemPage";
import { TenantNav } from "../../components/layout/TenantNav";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
  getTenantLeaseWorkspace: vi.fn(),
  refreshTenantLeaseDocumentUrl: vi.fn(),
  getTenantLeasePaymentStatus: vi.fn(),
  exportTenantIdentityPackage: vi.fn(),
  createInstitutionalHandoffDraft: vi.fn(),
  listInstitutionalHandoffDrafts: vi.fn(),
  voidInstitutionalHandoffDraft: vi.fn(),
  createTenantLeasePaymentCheckout: vi.fn(),
  signTenantLease: vi.fn(),
  listTenantWorkspaceMaintenance: vi.fn(),
  redeemTenantWorkspaceInvite: vi.fn(),
}));

const tenantApplicationCompletionApi = vi.hoisted(() => ({
  getTenantApplicationCompletion: vi.fn(),
}));

const tenantAccessApi = vi.hoisted(() => ({
  getTenantAccess: vi.fn(),
}));

const tenantAttachmentsApi = vi.hoisted(() => ({
  getTenantAttachments: vi.fn(),
}));

const tenantProfileApi = vi.hoisted(() => ({
  getTenantProfile: vi.fn(),
}));

const tenantNotificationPreferencesApi = vi.hoisted(() => ({
  getTenantNotificationPreferences: vi.fn(),
}));

const maintenanceWorkflowApi = vi.hoisted(() => ({
  listTenantMaintenance: vi.fn(),
}));

const tenantCommunicationsApi = vi.hoisted(() => ({
  getTenantCommunicationSummary: vi.fn(),
  getTenantCommunicationsWorkspace: vi.fn(),
}));

const tenantScreeningApi = vi.hoisted(() => ({
  listTenantScreenings: vi.fn(),
}));

const tenantSharePackagesApi = vi.hoisted(() => ({
  createTenantSharePackage: vi.fn(),
  listTenantSharePackages: vi.fn(),
  revokeTenantSharePackage: vi.fn(),
  respondToTenantSharePackage: vi.fn(),
  respondToTenantShareVerificationRequest: vi.fn(),
  revokeTenantShareVerificationRequest: vi.fn(),
}));

const tenantTrustExportsApi = vi.hoisted(() => ({
  listTenantTrustExports: vi.fn(),
  previewTenantTrustExport: vi.fn(),
  prepareTenantTrustExport: vi.fn(),
  revokeTenantTrustExport: vi.fn(),
}));

const tenantInstitutionAccessApi = vi.hoisted(() => ({
  listTenantInstitutionAccessGrants: vi.fn(),
  previewTenantInstitutionAccess: vi.fn(),
  createInstitutionReviewInvite: vi.fn(),
  resendInstitutionReviewDelivery: vi.fn(),
  revokeTenantInstitutionAccessGrant: vi.fn(),
}));

vi.mock("../../api/tenantPortal", () => tenantPortalApi);
vi.mock("../../api/tenantApplicationCompletion", () => tenantApplicationCompletionApi);
vi.mock("../../api/tenantAccess", () => tenantAccessApi);
vi.mock("../../api/tenantAttachmentsApi", () => tenantAttachmentsApi);
vi.mock("../../api/tenantProfile", () => tenantProfileApi);
vi.mock("../../api/tenantNotificationPreferences", () => tenantNotificationPreferencesApi);
vi.mock("../../api/tenantCommunicationsApi", () => tenantCommunicationsApi);
vi.mock("../../api/tenantScreeningApi", async () => {
  const actual = await vi.importActual<any>("../../api/tenantScreeningApi");
  return {
    ...actual,
    listTenantScreenings: tenantScreeningApi.listTenantScreenings,
  };
});
vi.mock("../../api/tenantSharePackages", () => tenantSharePackagesApi);
vi.mock("../../api/tenantTrustExports", () => tenantTrustExportsApi);
vi.mock("../../api/tenantInstitutionAccess", () => tenantInstitutionAccessApi);
vi.mock("../../api/maintenanceWorkflowApi", async () => {
  const actual = await vi.importActual<any>("../../api/maintenanceWorkflowApi");
  return {
    ...actual,
    listTenantMaintenance: maintenanceWorkflowApi.listTenantMaintenance,
  };
});

describe("tenant workspace frontend shell", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantCommunicationsApi.getTenantCommunicationSummary.mockResolvedValue({
      unreadMessages: 1,
      unreadNotices: 2,
      unreadScreeningUpdates: 1,
    });
    tenantCommunicationsApi.getTenantCommunicationsWorkspace.mockResolvedValue({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        propertyId: "prop-1",
        unitId: "unit-1",
        unreadCount: 1,
        lastMessageAt: "2026-04-10T00:00:00.000Z",
        messages: [
          {
            id: "msg-1",
            senderRole: "landlord",
            body: "Please confirm the final move-in details.",
            createdAt: "2026-04-10T00:00:00.000Z",
            createdAtMs: 1,
          },
        ],
      },
    });
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "in_progress",
      progressPercent: 62,
      sections: [],
      nextSteps: ["Upload government id"],
      updatedAt: "2026-01-02T00:00:00.000Z",
      reminderTiming: "due_now",
      reminderTimingLabel: "Due now",
      reminderTimingDescription: "A current checklist step is ready for your attention now.",
    });
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "screening-1",
          rentalApplicationId: "app-1",
          status: "consent_pending",
          normalizedResultStatus: "pending",
          requestedAt: 1710000000000,
          consentedAt: null,
          startedAt: null,
          completedAt: null,
          provider: "transunion_redirect",
          providerLabel: "TransUnion",
          packageType: "basic",
          payerType: "landlord",
          propertyLabel: "123 Main St",
          unitLabel: "Unit 4",
          applicantName: "Taylor Tenant",
          nextAction: "awaiting_applicant_consent",
          consent: null,
          session: null,
          result: null,
          returnFlow: null,
          summary: {
            status: "consent_pending",
            provider: "transunion_redirect",
            requestedDate: 1710000000000,
            package: "basic",
            summaryResult: "Consent is required before screening can begin.",
            nextActions: ["Provide consent"],
          },
          auditTrail: [],
        },
      ],
    });
    tenantAccessApi.getTenantAccess.mockResolvedValue({
      summary: {
        activeGrants: 1,
        pendingRequests: 0,
        latestActivityAt: 1000,
      },
      pendingRequests: [],
      activeAccess: [],
      recentActivity: [],
      guidance: {
        headline: "You can review and manage the access you’ve already shared.",
        body: "This view shows tenant-safe sharing records only.",
      },
    });
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
      tenantIdentityRecord: {
        identityStatus: "ready",
        profile: { completionStatus: "complete" },
        application: { reusable: true, lastSubmittedAt: "2026-01-02T00:00:00.000Z" },
        documents: { completionStatus: "in_progress", missingCategories: ["Income documents"] },
        screening: { status: "in_progress", lastCompletedAt: null },
        leases: { activeCount: 1, historicalCount: 0, lastSignedAt: "2026-02-01T10:00:00.000Z" },
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile, reusable application details, and supporting records are ready for most rental workflows.",
      },
      tenantCredibilitySignals: {
        signals: [
          { key: "profile_complete", label: "Profile complete", description: "desc", status: "verified" },
          { key: "application_reusable", label: "Application reusable", description: "desc", status: "available" },
          { key: "documents_available", label: "Documents available", description: "desc", status: "incomplete" },
          { key: "screening_completed", label: "Screening completed", description: "desc", status: "available" },
          { key: "lease_history_present", label: "Lease history present", description: "desc", status: "verified" },
        ],
        summary: {
          completenessLevel: "high",
          verificationLevel: "partial",
          summaryLabel: "Credibility established",
          summaryDescription: "Most credibility signals are available in your current record.",
        },
      },
      portableIdentity: {
        portabilityStatus: "ready",
        portabilityLabel: "Ready to reuse",
        portabilityDescription:
          "Your rental identity is organized for reuse across application contexts, and sharing controls are available when you need them.",
        reusableAcrossApplications: true,
        identityReference: {
          referenceType: "tenant_identity",
          referenceStatus: "active",
        },
        readiness: {
          identityReady: true,
          applicationReusable: true,
          credibilityReady: true,
          sharingEnabled: true,
        },
        nextAction: "none",
      },
      identityTimeline: {
        events: [
          {
            type: "application.created",
            label: "Application created",
            description: "A rental application record was started.",
            occurredAt: "2026-01-01T00:00:00.000Z",
          },
          {
            type: "screening_consent_confirmed",
            label: "Screening authorized",
            description: "Screening consent was recorded for this application.",
            occurredAt: "2026-01-03T00:00:00.000Z",
          },
          {
            type: "lease.tenant_signed",
            label: "Lease signed",
            description: "Tenant lease signing was recorded.",
            occurredAt: "2026-02-01T10:00:00.000Z",
          },
        ],
      },
    });
    tenantPortalApi.listInstitutionalHandoffDrafts.mockResolvedValue([]);
    tenantPortalApi.createInstitutionalHandoffDraft.mockResolvedValue({
      id: "handoff-1",
      tenantId: "tenant-1",
      institutionProfile: {
        institutionType: "bank",
        displayName: "Example Bank Sandbox",
        integrationMode: "sandbox",
        status: "draft_only",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "partial",
        validationStatus: "valid_with_warnings",
      },
      handoffStatus: "ready_for_manual_review",
      exportStorage: "metadata_only",
      outboundTransfer: "none",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z",
    });
    tenantPortalApi.voidInstitutionalHandoffDraft.mockResolvedValue({
      id: "handoff-1",
      tenantId: "tenant-1",
      institutionProfile: {
        institutionType: "bank",
        displayName: "Example Bank Sandbox",
        integrationMode: "sandbox",
        status: "draft_only",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "partial",
        validationStatus: "valid_with_warnings",
      },
      handoffStatus: "voided",
      exportStorage: "metadata_only",
      outboundTransfer: "none",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:05:00.000Z",
    });
    tenantPortalApi.exportTenantIdentityPackage.mockResolvedValue({
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
        generatedAt: "2026-04-27T00:00:00.000Z",
        jurisdiction: "CA",
        dataScope: "tenant_controlled_export",
        consentRequired: true,
      },
      subject: {
        subjectType: "tenant",
        identityStatus: "ready",
        verificationLevel: "partial",
        completenessLevel: "high",
      },
      identity: {
        portabilityStatus: "ready",
        identityReadiness: "ready",
        credibilityReadiness: "high",
      },
      rentalHistory: {
        activeLeaseAvailable: true,
        leaseExecutionStatus: "executed",
        leaseSummaryAvailable: true,
      },
      paymentReadiness: {
        rentTermsReady: true,
        paymentRailAvailable: false,
        latestPaymentStatus: "not_available",
      },
      audit: {
        auditTrailAvailable: true,
        totalIdentityEvents: 2,
        recentActivityAvailable: true,
      },
      validation: {
        status: "valid",
        warnings: [],
        missingRecommendedFields: [],
      },
      complianceReadiness: {
        readinessStatus: "partial",
        readinessLabel: "Partially ready for institutional review",
        readinessDescription:
          "Core export controls are present, but some audit or consent signals are still limited in this tenant-controlled summary.",
        checks: [
          {
            key: "schema_validated",
            status: "pass",
            label: "Schema validated",
            description: "desc",
          },
          {
            key: "identity_trace_available",
            status: "warning",
            label: "Identity trace available",
            description: "desc",
          },
          {
            key: "consent_controls_available",
            status: "warning",
            label: "Consent controls available",
            description: "desc",
          },
          {
            key: "export_tenant_controlled",
            status: "pass",
            label: "Tenant-controlled export",
            description: "desc",
          },
          {
            key: "sensitive_data_minimized",
            status: "pass",
            label: "Sensitive data minimized",
            description: "desc",
          },
        ],
        exportTraceability: {
          exportAvailable: true,
          schemaVersion: "2.0",
          exportStorage: "not_stored",
          outboundTransfer: "none",
        },
        auditTraceability: {
          traceabilityStatus: "ready",
          traceabilityLabel: "Ready for summary-only review",
          traceabilityDescription:
            "Reduced, tenant-safe audit traceability is available for on-demand exports and metadata-only handoff preparation, with some institutional logging gaps still disclosed.",
          evidenceCoverage: {
            identityTimelineAvailable: true,
            exportGeneratedOnDemand: true,
            exportStoredByRentChain: false,
            handoffDraftMetadataAvailable: true,
            manualReleasePreparationAvailable: true,
            observabilityCoverage: "draft_creation_only",
            canonicalInstitutionEventsAvailable: false,
          },
          readinessGaps: [
            "institutional_export_events_not_recorded",
            "institutional_handoff_lifecycle_events_limited",
            "access_audit_summary_not_available",
          ],
        },
      },
      extensions: {
        reserved: {},
      },
    });
    tenantPortalApi.createTenantLeasePaymentCheckout.mockResolvedValue({
      rentPaymentId: "rp-1",
      status: "checkout_created",
      redirectUrl: "https://checkout.stripe.test/session/cs_test_1",
    });
    tenantPortalApi.getTenantLeasePaymentStatus.mockResolvedValue({
      paymentRail: {
        enabled: true,
        enabledAt: "2026-04-27T10:00:00.000Z",
        processor: "stripe",
        blockedReason: null,
      },
      latestPayment: null,
      paymentExperience: {
        history: [],
        latestStatus: null,
        retryAvailable: false,
        receiptSummary: {
          available: false,
          label: "No payment summary available yet",
          amountCents: null,
          paidAt: null,
          leaseReference: null,
        },
      },
    });
    tenantPortalApi.refreshTenantLeaseDocumentUrl.mockResolvedValue({
      documentUrl: "https://example.com/refreshed-lease.pdf",
      displayLabel: "Signed lease document",
      documentStatus: "signed",
      source: "leaseDocument",
      expiresInSeconds: 1800,
    });
    vi.spyOn(window, "open").mockReturnValue(null);
    tenantAttachmentsApi.getTenantAttachments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "doc-1",
          label: "Government ID",
          category: "Identity",
          status: "uploaded",
          fileName: "id-card.pdf",
          uploadedAt: 1710000000000,
        },
      ],
      summary: {
        total: 1,
        missing: 0,
        uploaded: 1,
        pendingReview: 0,
        verified: 0,
        needsAttention: 0,
      },
      guidance: {
        headline: "Your current tenant-safe document record is up to date.",
        nextSteps: [],
        uploadEntryAvailable: false,
        uploadEntryLabel: null,
        uploadEntryPath: null,
        supportPath: "/tenant/messages",
        supportLabel: "Message your landlord",
      },
      updatedAt: 1710000000000,
    });
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Active tenant",
        property: {
          propertyId: "prop-1",
          rc_prop_id: "rc-prop-1",
          street1: "123 Main St",
          street2: "Unit 4",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H1A1",
          features: ["laundry"],
        },
        application: {
          applicationId: "app-1",
          status: "submitted",
          missingSteps: [],
          nextActions: [],
          createdAt: null,
          updatedAt: null,
        },
        lease: {
          leaseId: "lease-1",
          startDate: "2026-02-01",
          endDate: "2027-01-31",
          monthlyRent: 1800,
          status: "active",
          documentUrl: null,
        },
      },
      identity: {
        overallStatus: "pending",
        identityVerification: {
          status: "pending",
          label: "Pending",
          note: "Verification is still in progress.",
          updatedAt: "2026-01-05T00:00:00.000Z",
        },
        documentChecklist: [
          {
            code: "upload_id",
            label: "Upload Id",
            status: "missing",
            nextStep: "Upload government id",
          },
        ],
        nextSteps: ["Upload government id"],
      },
      actions: {
        editableFields: ["displayName", "phone"],
        documentEntry: {
          available: true,
          path: "/tenant/attachments",
          label: "Review requested documents",
          note: "1 document-related step still needs attention.",
        },
      },
    });
    tenantNotificationPreferencesApi.getTenantNotificationPreferences.mockResolvedValue({
      inApp: {
        follow_up_requested: true,
        ready_for_rereview: true,
        application_updated: true,
        access_changed: true,
        documents_updated: true,
      },
      updatedAt: 1710000000000,
    });
    tenantSharePackagesApi.listTenantSharePackages.mockResolvedValue([]);
    tenantTrustExportsApi.listTenantTrustExports.mockResolvedValue([]);
    tenantTrustExportsApi.previewTenantTrustExport.mockResolvedValue({
      exportId: null,
      schemaVersion: "tenant_trust_export.v1",
      audience: "tenant_portability",
      purpose: "tenant_controlled_portability",
      lifecycle: "consent_required",
      consent: {
        required: true,
        granted: false,
        consentId: null,
        consentVersion: "tenant_trust_export_consent.v1",
        grantedAt: null,
        expiresAt: "2026-05-23T00:00:00.000Z",
        revokedAt: null,
        audience: "tenant_portability",
        purpose: "tenant_controlled_portability",
        claimCategories: ["tenant_portability"],
        summary:
          "Tenant consent is required before RentChain prepares this non-public, metadata-only trust export package.",
      },
      expiresAt: "2026-05-23T00:00:00.000Z",
      revokedAt: null,
      generatedAt: "2026-05-09T00:00:00.000Z",
      metadataOnly: true,
      publicAccessEnabled: false,
      externalSubmissionEnabled: false,
      policyGated: true,
      package: {
        exportId: "tenant_trust_export_preview",
        status: "blocked",
        lifecycle: "blocked",
        blockedReasons: ["tenant_trust:tenant_portability: consent_missing"],
        exportSummaries: [],
        auditMetadata: {
          exportId: "tenant_trust_export_preview",
          consentScoped: true,
          policyGated: true,
          manualOnly: true,
          publicAccessEnabled: false,
          externalSubmissionEnabled: false,
          portableAttestationCount: 1,
          exportableAttestationCount: 0,
          blockedAttestationCount: 1,
        },
      },
      includedClaims: [],
      excludedClaims: [
        {
          attestationId: "tenant_trust:tenant_portability",
          claimCategory: "tenant_portability",
          claimLabel: "tenant portability",
          reasons: ["consent_missing"],
        },
      ],
      redactions: ["Support/internal metadata is excluded."],
      disclaimers: ["No institution receives this package automatically."],
    });
    tenantTrustExportsApi.prepareTenantTrustExport.mockResolvedValue({
      exportId: "export-1",
      schemaVersion: "tenant_trust_export.v1",
      audience: "tenant_portability",
      purpose: "tenant_controlled_portability",
      lifecycle: "prepared",
      consent: {
        required: true,
        granted: true,
        consentId: "consent-1",
        consentVersion: "tenant_trust_export_consent.v1",
        grantedAt: "2026-05-09T00:00:00.000Z",
        expiresAt: "2026-05-23T00:00:00.000Z",
        revokedAt: null,
        audience: "tenant_portability",
        purpose: "tenant_controlled_portability",
        claimCategories: ["tenant_portability"],
        summary:
          "Tenant consent is required before RentChain prepares this non-public, metadata-only trust export package.",
      },
      expiresAt: "2026-05-23T00:00:00.000Z",
      revokedAt: null,
      generatedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
      metadataOnly: true,
      publicAccessEnabled: false,
      externalSubmissionEnabled: false,
      policyGated: true,
      package: {
        exportId: "export-1",
        status: "export_ready",
        lifecycle: "policy_evaluated",
        blockedReasons: [],
        exportSummaries: [],
        auditMetadata: {
          exportId: "export-1",
          consentScoped: true,
          policyGated: true,
          manualOnly: true,
          publicAccessEnabled: false,
          externalSubmissionEnabled: false,
          portableAttestationCount: 1,
          exportableAttestationCount: 1,
          blockedAttestationCount: 0,
        },
      },
      includedClaims: [
        {
          attestationId: "tenant_trust:tenant_portability",
          claimCategory: "tenant_portability",
          claimLabel: "Tenant portability metadata available",
          lifecycleState: "export_ready",
          consentExpiresAt: "2026-05-23T00:00:00.000Z",
        },
      ],
      excludedClaims: [],
      redactions: ["Support/internal metadata is excluded."],
      disclaimers: ["No institution receives this package automatically."],
    });
    tenantTrustExportsApi.revokeTenantTrustExport.mockImplementation(async (exportId: string) => ({
      ...(await tenantTrustExportsApi.prepareTenantTrustExport()),
      exportId,
      lifecycle: "revoked",
      revokedAt: "2026-05-10T00:00:00.000Z",
    }));
    tenantInstitutionAccessApi.listTenantInstitutionAccessGrants.mockResolvedValue([]);
    const institutionAccessPreview = {
      grantId: null,
      schemaVersion: "tenant_institution_access.v1",
      audience: "insurer",
      purpose: "insurance_review",
      lifecycle: "consent_required",
      recipient: {
        email: "reviewer@example.com",
        displayName: null,
        organizationName: "Example Insurance",
        authenticationRequirement: "recipient_email_session_required",
      },
      consent: {
        required: true,
        granted: false,
        consentId: null,
        consentVersion: "tenant_institution_access_consent.v1",
        grantedAt: null,
        expiresAt: "2026-05-23T00:00:00.000Z",
        revokedAt: null,
        audience: "insurer",
        purpose: "insurance_review",
        recipientEmail: "reviewer@example.com",
        claimCategories: ["tenant_portability"],
        summary:
          "Tenant consent is required before RentChain prepares this non-public, metadata-only institution access grant.",
      },
      expiresAt: "2026-05-23T00:00:00.000Z",
      revokedAt: null,
      generatedAt: "2026-05-09T00:00:00.000Z",
      metadataOnly: true,
      policyGated: true,
      publicAccessEnabled: false,
      publicProfileEnabled: false,
      externalSubmissionEnabled: false,
      providerIntegrationEnabled: false,
      automatedDecisioningEnabled: false,
      recipientAccess: {
        enabled: false,
        accessUrl: null,
        accessTokenIssued: false,
        recipientAuthenticationRequired: true,
        sessionBound: true,
        downloadEnabled: false,
        summary:
          "Recipient access is modeled for controlled future review only; no public link or external delivery is created by this grant.",
      },
      package: {
        status: "blocked",
        blockedReasons: ["tenant_trust:tenant_portability: consent_missing"],
        exportSummaries: [],
      },
      includedClaims: [],
      excludedClaims: [
        {
          attestationId: "tenant_trust:tenant_portability",
          claimCategory: "tenant_portability",
          claimLabel: "tenant portability",
          reasons: ["consent_missing"],
        },
      ],
      redactions: ["Support/internal metadata is excluded.", "Public trust profiles and public links are not created."],
      disclaimers: ["This access grant is tenant-mediated and metadata-only."],
    };
    const institutionAccessGrant = {
      ...institutionAccessPreview,
      grantId: "grant-1",
      lifecycle: "active",
      consent: {
        ...institutionAccessPreview.consent,
        granted: true,
        consentId: "consent-1",
        grantedAt: "2026-05-09T00:00:00.000Z",
      },
      package: {
        status: "export_ready",
        blockedReasons: [],
        exportSummaries: [],
      },
      includedClaims: [
        {
          attestationId: "tenant_trust:tenant_portability",
          claimCategory: "tenant_portability",
          claimLabel: "Tenant portability metadata available",
          lifecycleState: "export_ready",
          consentExpiresAt: "2026-05-23T00:00:00.000Z",
        },
      ],
      excludedClaims: [],
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z",
      events: [
        {
          eventType: "tenant_institution_access_granted",
          occurredAt: "2026-05-09T00:00:00.000Z",
          actorType: "tenant",
          metadataOnly: true,
          outcome: "granted",
          status: "granted",
          reason: "access_granted",
        },
        {
          eventType: "recipient_trust_review_opened",
          occurredAt: "2026-05-09T01:00:00.000Z",
          actorType: "recipient",
          metadataOnly: true,
          outcome: "opened",
          status: "available",
          reason: "review_available",
        },
        {
          eventType: "recipient_trust_review_blocked",
          occurredAt: "2026-05-09T02:00:00.000Z",
          actorType: "recipient",
          metadataOnly: true,
          outcome: "blocked",
          status: "recipient_mismatch",
          reason: "recipient_email_mismatch",
        },
      ],
      auditSummary: {
        schemaVersion: "recipient_access_audit.v1",
        metadataOnly: true,
        totalEvents: 3,
        openedReviewCount: 1,
        blockedReviewCount: 1,
        revokedAccessCount: 0,
        expiredAccessCount: 0,
        lastActivityAt: "2026-05-09T02:00:00.000Z",
        lastOpenedAt: "2026-05-09T01:00:00.000Z",
        lastBlockedAt: "2026-05-09T02:00:00.000Z",
        lastOutcome: "blocked",
        lastReason: "recipient_email_mismatch",
        recipientIdentifier: {
          email: "reviewer@example.com",
          redactedEmail: "re***@example.com",
          organizationName: "Example Insurance",
        },
        visibility: {
          tenantVisible: true,
          supportSafe: true,
          trustPayloadIncluded: false,
          supportMetadataIncluded: false,
          rawProviderPayloadIncluded: false,
          publicAccessEnabled: false,
          downloadEnabled: false,
        },
      },
      auditTimeline: [
        {
          eventType: "recipient_trust_review_blocked",
          occurredAt: "2026-05-09T02:00:00.000Z",
          actorType: "recipient",
          outcome: "blocked",
          status: "recipient_mismatch",
          reason: "recipient_email_mismatch",
          metadataOnly: true,
        },
        {
          eventType: "recipient_trust_review_opened",
          occurredAt: "2026-05-09T01:00:00.000Z",
          actorType: "recipient",
          outcome: "opened",
          status: "available",
          reason: "review_available",
          metadataOnly: true,
        },
        {
          eventType: "tenant_institution_access_granted",
          occurredAt: "2026-05-09T00:00:00.000Z",
          actorType: "tenant",
          outcome: "granted",
          status: "granted",
          reason: "access_granted",
          metadataOnly: true,
        },
      ],
      pilotOperation: {
        schemaVersion: "pilot_institution_review_operation.v1",
        status: "review_escalated",
        statusLabel: "Review escalated",
        escalation: {
          required: true,
          reasons: ["recipient_access_issue"],
          primaryReason: "recipient_access_issue",
        },
        coordination: {
          reviewNeedsFollowUp: true,
          nextOperationalAction: "recipient_followup",
          supportOnly: true,
          freeformNotesEnabled: false,
        },
        continuity: {
          grantLifecycle: "active",
          inviteStatus: "invited",
          deliveryStatus: "sent",
          sessionState: "active",
          trustExportLifecycle: "active",
          revocationVisible: false,
          expirationVisible: false,
          supersessionVisible: false,
          policyDeniedVisible: false,
        },
        reporting: {
          openedReviewCount: 1,
          blockedReviewCount: 1,
          sessionStartedCount: 1,
          deliveryAttemptCount: 1,
          lastActivityAt: "2026-05-09T02:00:00.000Z",
        },
        visibility: {
          tenantVisible: true,
          supportSafe: true,
          operatorVisible: true,
          recipientVisible: false,
          portableVisible: false,
          metadataOnly: true,
          trustPayloadIncluded: false,
          providerPayloadIncluded: false,
          supportMetadataIncluded: false,
          publicAccessEnabled: false,
          downloadEnabled: false,
        },
      },
    };
    tenantInstitutionAccessApi.previewTenantInstitutionAccess.mockResolvedValue(institutionAccessPreview);
    tenantInstitutionAccessApi.createInstitutionReviewInvite.mockResolvedValue({
      ...institutionAccessGrant,
      institutionReviewInvite: {
        schemaVersion: "institution_review_invite.v1",
        status: "invited",
        recipientEmail: "reviewer@example.com",
        redactedRecipientEmail: "re***@example.com",
        organizationName: "Example Insurance",
        audience: "insurer",
        purpose: "insurance_review",
        reviewUrl: "https://www.rentchain.test/recipient/trust-review/grant-1",
        createdAt: "2026-05-09T00:00:00.000Z",
        sentAt: "2026-05-09T00:01:00.000Z",
        openedAt: null,
        authenticatedAt: null,
        expiresAt: "2026-05-16T00:00:00.000Z",
        revokedAt: null,
        recipientAuthenticationRequired: true,
        inviteTokenIssued: false,
        bearerAccessEnabled: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
        metadataOnly: true,
        summary: "This invitation points the recipient to an authenticated review.",
      },
      institutionReviewDelivery: {
        schemaVersion: "institution_review_delivery.v1",
        status: "sent",
        attemptCount: 1,
        lastAttemptAt: "2026-05-09T00:00:30.000Z",
        lastSentAt: "2026-05-09T00:01:00.000Z",
        lastFailedAt: null,
        lastFailureReason: null,
        recipientEmail: "reviewer@example.com",
        redactedRecipientEmail: "re***@example.com",
        audience: "insurer",
        purpose: "insurance_review",
        reviewUrl: "https://www.rentchain.test/recipient/trust-review/grant-1",
        tenantAuthorized: true,
        recipientAuthenticationRequired: true,
        bearerAccessEnabled: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
        metadataOnly: true,
        summary: "Delivery is tenant-authorized and metadata-only.",
      },
    });
    tenantInstitutionAccessApi.resendInstitutionReviewDelivery.mockImplementation(async (grantId: string) => ({
      ...institutionAccessGrant,
      grantId,
      institutionReviewDelivery: {
        schemaVersion: "institution_review_delivery.v1",
        status: "resent",
        attemptCount: 2,
        lastAttemptAt: "2026-05-09T03:00:00.000Z",
        lastSentAt: "2026-05-09T03:00:05.000Z",
        lastFailedAt: null,
        lastFailureReason: null,
        recipientEmail: "reviewer@example.com",
        redactedRecipientEmail: "re***@example.com",
        audience: "insurer",
        purpose: "insurance_review",
        reviewUrl: "https://www.rentchain.test/recipient/trust-review/grant-1",
        tenantAuthorized: true,
        recipientAuthenticationRequired: true,
        bearerAccessEnabled: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
        metadataOnly: true,
        summary: "Delivery is tenant-authorized and metadata-only.",
      },
    }));
    tenantInstitutionAccessApi.revokeTenantInstitutionAccessGrant.mockImplementation(async (grantId: string) => ({
      ...institutionAccessGrant,
      grantId,
      lifecycle: "revoked",
      revokedAt: "2026-05-10T00:00:00.000Z",
      consent: {
        ...institutionAccessGrant.consent,
        granted: false,
        revokedAt: "2026-05-10T00:00:00.000Z",
      },
      auditSummary: {
        ...institutionAccessGrant.auditSummary,
        revokedAccessCount: 1,
        lastActivityAt: "2026-05-10T00:00:00.000Z",
        lastOutcome: "revoked",
        lastReason: "access_revoked",
      },
    }));
    tenantSharePackagesApi.createTenantSharePackage.mockResolvedValue({
      id: "share-1",
      createdAt: 1710000000000,
      expiresAt: 1710600000000,
      status: "active",
      permissions: {
        identitySummary: true,
        credibilitySummary: false,
        applicationSummary: false,
        documents: "none",
        leaseSummary: false,
        paymentReadinessSummary: false,
      },
      requestedItems: [],
      approvedItems: [],
      verificationRequests: [],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
        exchangeReadiness: {
          identityReady: true,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: true,
          paymentReadinessAvailable: false,
        },
      },
      shareUrl: "https://app.example/share/share-token-1",
    });
    tenantSharePackagesApi.revokeTenantSharePackage.mockResolvedValue(undefined);
    tenantSharePackagesApi.respondToTenantSharePackage.mockResolvedValue({
      id: "share-1",
      createdAt: 1710000000000,
      expiresAt: 1710600000000,
      status: "active",
      permissions: {
        identitySummary: true,
        credibilitySummary: true,
        applicationSummary: false,
        documents: "approved_only",
        leaseSummary: false,
        paymentReadinessSummary: false,
      },
      requestedItems: [],
      approvedItems: ["credibility_summary", "documents_summary"],
      verificationRequests: [],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
        exchangeReadiness: {
          identityReady: true,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: true,
          paymentReadinessAvailable: false,
        },
      },
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    global.URL.createObjectURL = vi.fn(() => "blob:institutional-export");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("tenant shell renders expected navigation safely", async () => {
    render(
      <MemoryRouter>
        <TenantNav>
          <div>Tenant content</div>
        </TenantNav>
      </MemoryRouter>
    );

    expect(await screen.findByText(/RentChain Tenant Space/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Screening Requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Access/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Documents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /History/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Application/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lease/i })).toBeInTheDocument();
  });

  it("renders loading state safely", () => {
    tenantPortalApi.getTenantWorkspace.mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading your workspace/i)).toBeInTheDocument();
  });

  it("renders workspace summary with safe projected data", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: {
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        street1: "123 Main St",
        street2: "Unit 4",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
        features: ["laundry"],
      },
      application: {
        applicationId: "app-1",
        status: "submitted",
        missingSteps: ["upload_id"],
        nextActions: ["finish_profile"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "active",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription:
            "The current lease shows the core rent terms and tenancy linkage needed for a future payment setup workflow, without enabling any payment activity today.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: false,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        rentPaymentSummary: {
          paymentRail: {
            enabled: true,
            enabledAt: "2026-04-27T10:00:00.000Z",
            processor: "stripe",
            blockedReason: null,
          },
          latestPayment: null,
        },
      },
      maintenance: [],
      tenantIdentityRecord: {
        identityStatus: "ready",
        profile: { completionStatus: "complete" },
        application: { reusable: true, lastSubmittedAt: "2026-01-02T00:00:00.000Z" },
        documents: { completionStatus: "in_progress", missingCategories: ["Income documents"] },
        screening: { status: "in_progress", lastCompletedAt: null },
        leases: { activeCount: 1, historicalCount: 0, lastSignedAt: "2026-02-01T10:00:00.000Z" },
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile, reusable application details, and supporting records are ready for most rental workflows.",
      },
      tenantCredibilitySignals: {
        signals: [
          { key: "profile_complete", label: "Profile complete", description: "desc", status: "verified" },
          { key: "application_reusable", label: "Application reusable", description: "desc", status: "available" },
          { key: "documents_available", label: "Documents available", description: "desc", status: "incomplete" },
          { key: "screening_completed", label: "Screening completed", description: "desc", status: "available" },
          { key: "lease_history_present", label: "Lease history present", description: "desc", status: "verified" },
        ],
        summary: {
          completenessLevel: "high",
          verificationLevel: "partial",
          summaryLabel: "Credibility established",
          summaryDescription: "Most credibility signals are available in your current record.",
        },
      },
      portableIdentity: {
        portabilityStatus: "ready",
        portabilityLabel: "Ready to reuse",
        portabilityDescription:
          "Your rental identity is organized for reuse across application contexts, and sharing controls are available when you need them.",
        reusableAcrossApplications: true,
        identityReference: {
          referenceType: "tenant_identity",
          referenceStatus: "active",
        },
        readiness: {
          identityReady: true,
          applicationReusable: true,
          credibilityReady: true,
          sharingEnabled: true,
        },
        nextAction: "none",
      },
      identityTimeline: {
        events: [
          {
            type: "application.created",
            label: "Application created",
            description: "A rental application record was started.",
            occurredAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Tenant Dashboard$/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Your tenancy is active/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/What to do next/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue to your dashboard/i })).toBeInTheDocument();
    expect(await screen.findByText(/Recent activity \/ notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent workflow updates/i)).toBeInTheDocument();
    expect(await screen.findByText(/Profile completion/i)).toBeInTheDocument();
    expect(screen.getByText(/^Your Rental Identity$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Credibility signals$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Portable Rental Identity$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Payment readiness$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Activity timeline$/i)).toBeInTheDocument();
    expect(screen.getByText("Identity ready")).toBeInTheDocument();
    expect(screen.getByText("Sharing controls available")).toBeInTheDocument();
    expect(screen.getByText("Reusable across applications")).toBeInTheDocument();
    expect(screen.getByText(/Credibility established/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile complete/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Application reusable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Documents available/i)).toBeInTheDocument();
    expect(screen.getByText(/Screening completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Lease history present/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to apply/i)).toBeInTheDocument();
    expect(screen.getByText(/Rent terms ready for future setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm payment setup later/i)).toBeInTheDocument();
    expect(screen.queryByText(/Internal Lease ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText("lease-1")).not.toBeInTheDocument();
    expect(screen.getByText(/^Application created$/i)).toBeInTheDocument();
    expect(screen.getByText(/A rental application record was started\./i)).toBeInTheDocument();
    expect(screen.getByText(/Missing pieces/i)).toBeInTheDocument();
    expect(screen.getByText(/Income documents/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage Shared Access/i)).toBeInTheDocument();
    expect(screen.getByText(/Review the remaining profile area to keep your rental profile organized/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View your profile/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Applicant$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Active tenancy/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/A lease reference is visible in your tenant workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment processed by Stripe\. RentChain does not store card or bank payment details\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay rent/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open payments/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Needs reply/i)).toBeInTheDocument();
    expect(screen.getByText(/Please confirm the final move-in details/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open communications inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/Screening consent requested for 1 application/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review request/i })).toBeInTheDocument();
    expect(screen.getByText(/123 Main St, Unit 4, Halifax, NS/i)).toBeInTheDocument();
    expect(screen.getByText(/finish_profile/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 active access grant/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 document in your vault, 1 ready to share, and 0 still needing attention/i)).toBeInTheDocument();
    expect(screen.getByText(/Documents updated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No action needed/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open document vault/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open access/i })).toBeInTheDocument();
  });

  it("includes tenant-safe lease attachment context in dashboard document summary", async () => {
    const workspace = await tenantPortalApi.getTenantWorkspace();
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      ...workspace,
      lease: {
        leaseId: "lease-1",
        startDate: null,
        endDate: null,
        monthlyRent: null,
        status: "active",
        documentUrl: null,
        leaseDocumentContext: null,
        scheduleADocumentContext: {
          leaseId: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          leaseStatus: "active",
          signingStatus: null,
          documentStatus: "generated",
          documentId: "schedule-a-doc",
          documentUrl: "https://signed.example/schedule-a.pdf",
          displayLabel: "Schedule A",
          source: "tenant-safe-lease-workspace",
          confidence: "high",
          warnings: [],
        },
      },
    });
    tenantAttachmentsApi.getTenantAttachments.mockResolvedValue({
      ok: true,
      data: [],
      summary: {
        total: 0,
        missing: 0,
        uploaded: 0,
        pendingReview: 0,
        verified: 0,
        needsAttention: 0,
      },
      guidance: {
        headline: "You have not added any tenant-visible documents yet.",
        nextSteps: [],
        uploadEntryAvailable: false,
        uploadEntryLabel: null,
        uploadEntryPath: null,
        supportPath: "/tenant/messages",
        supportLabel: "Message your landlord",
      },
      updatedAt: null,
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Tenant Dashboard$/i)).toBeInTheDocument();
    expect(screen.getByText(/1 document in your vault, 1 ready to share, and 0 still needing attention/i)).toBeInTheDocument();
    expect(screen.queryByText(/schedule-a-doc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tenant-1/i)).not.toBeInTheDocument();
  });

  it("starts tenant checkout from the workspace when rent collection is enabled", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "active",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription: "Ready.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: true,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        rentPaymentSummary: {
          paymentRail: {
            enabled: true,
            enabledAt: "2026-04-27T10:00:00.000Z",
            processor: "stripe",
            blockedReason: null,
          },
          latestPayment: null,
        },
      },
      maintenance: [],
      tenantIdentityRecord: null,
      tenantCredibilitySignals: null,
      identityTimeline: { events: [] },
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Pay rent/i }));

    await waitFor(() => {
      expect(tenantPortalApi.createTenantLeasePaymentCheckout).toHaveBeenCalledWith("lease-1");
    });
  });

  it("renders workspace payment history, retry state, and print-safe summary", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "active",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription: "Ready.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: true,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        rentPaymentSummary: {
          paymentRail: {
            enabled: true,
            enabledAt: "2026-04-27T10:00:00.000Z",
            processor: "stripe",
            blockedReason: null,
          },
          latestPayment: null,
        },
      },
      maintenance: [],
      tenantIdentityRecord: null,
      tenantCredibilitySignals: null,
      identityTimeline: { events: [] },
    });
    tenantPortalApi.getTenantLeasePaymentStatus.mockResolvedValueOnce({
      paymentRail: {
        enabled: true,
        enabledAt: "2026-04-27T10:00:00.000Z",
        processor: "stripe",
        blockedReason: null,
      },
      latestPayment: {
        id: "rp-2",
        amountCents: 180000,
        currency: "cad",
        status: "failed",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:00.000Z",
        paidAt: null,
      },
      paymentExperience: {
        history: [
          {
            id: "rp-2",
            amountCents: 180000,
            currency: "cad",
            status: "failed",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
            paidAt: null,
          },
          {
            id: "rp-1",
            amountCents: 180000,
            currency: "cad",
            status: "paid",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            paidAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        latestStatus: "failed",
        retryAvailable: true,
        receiptSummary: {
          available: true,
          label: "Payment summary available",
          amountCents: 180000,
          paidAt: "2026-03-20T00:00:00.000Z",
          leaseReference: "lease-1",
        },
      },
    });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Payment history/i)).toBeInTheDocument();
    expect(screen.getByText(/The payment attempt did not complete successfully\. You can try checkout again\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Payment failed$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Retry payment/i })).toBeInTheDocument();
    expect(screen.getByText(/Payment summary available/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Print \/ Save payment summary/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("renders a safe empty activity timeline", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
      tenantIdentityRecord: null,
      tenantCredibilitySignals: null,
      identityTimeline: { events: [] },
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Activity timeline$/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Identity-related activity will appear here as your application, screening, and lease workflow progress\./i
      )
    ).toBeInTheDocument();
  });

  it("lets tenants generate, copy, and revoke share links", async () => {
    tenantSharePackagesApi.listTenantSharePackages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "share-1",
          createdAt: 1710000000000,
          expiresAt: 1710600000000,
          status: "active",
          permissions: {
            identitySummary: true,
            credibilitySummary: false,
            applicationSummary: false,
            documents: "none",
            leaseSummary: false,
            paymentReadinessSummary: false,
          },
          requestedItems: [],
          approvedItems: [],
          verificationRequests: [],
          identityExchangeReference: {
            referenceType: "tenant_identity_reference",
            referenceStatus: "available",
            referenceLabel: "Identity exchange available",
            referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
            portabilityStatus: "ready",
            exchangeReadiness: {
              identityReady: true,
              credibilityReady: true,
              sharingControlsReady: true,
              auditTimelineReady: true,
              paymentReadinessAvailable: false,
            },
          },
        },
      ]);

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Manage Shared Access/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Generate share link/i }));

    expect(await screen.findByTestId("fresh-share-url")).toHaveTextContent("https://app.example/share/share-token-1");
    expect(tenantSharePackagesApi.createTenantSharePackage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Copy latest link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://app.example/share/share-token-1");
    expect(
      screen.getByText(
        /Reuse path: This link can support summary-only follow-through today\. Broader reuse still requires your approval\./i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Revoke link/i }));
    await waitFor(() => {
      expect(tenantSharePackagesApi.revokeTenantSharePackage).toHaveBeenCalledWith("share-1");
    });
  });

  it("lets tenants preview and download an institutional identity export safely", async () => {
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Institutional readiness/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Export Rental Identity/i }));

    await waitFor(() => {
      expect(tenantPortalApi.exportTenantIdentityPackage).toHaveBeenCalledWith("2.0");
    });

    expect(await screen.findByRole("button", { name: /Hide preview/i })).toBeInTheDocument();
    expect(screen.getByText(/Export preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Schema version/i)).toBeInTheDocument();
    expect(screen.getByText(/Institution-ready structure/i)).toBeInTheDocument();
    expect(screen.getByText(/Validation status/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance readiness/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Audit traceability/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Draft metadata trace/i)).toBeInTheDocument();
    expect(screen.getByText(/Institution event coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft creation only/i)).toBeInTheDocument();
    expect(screen.getByText(/Exports are generated on request and are not stored by RentChain/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No data is sent automatically/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/This audit traceability summary reflects reduced, tenant-safe evidence only/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Current gaps: export generation is not recorded as an institutional event stream/i)).toBeInTheDocument();
    expect(screen.queryByText(/SOC2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/certification/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/guaranteed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/send to bank/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ready to send/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delivered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/drawnDataUrl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/paymentMethod/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lease activated/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Download JSON/i }));
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("requires consent before preparing a tenant-controlled trust export", async () => {
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant-controlled trust export/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prepare export/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Preview trust export/i }));
    await waitFor(() => {
      expect(tenantTrustExportsApi.previewTenantTrustExport).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "tenant_portability",
          consentAccepted: false,
        })
      );
    });
    expect(await screen.findByText(/No claims are exportable until consent and policy checks pass/i)).toBeInTheDocument();
    expect(screen.getByText(/Support\/internal metadata is excluded/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/I consent to preparing a metadata-only trust export/i));
    fireEvent.click(screen.getByRole("button", { name: /Prepare export/i }));

    await waitFor(() => {
      expect(tenantTrustExportsApi.prepareTenantTrustExport).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "tenant_portability",
          consentAccepted: true,
        })
      );
    });
    expect(await screen.findByText(/Tenant portability metadata available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Public access/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Disabled/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/verified tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reputation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/send to insurer/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Revoke export/i }));
    await waitFor(() => {
      expect(tenantTrustExportsApi.revokeTenantTrustExport).toHaveBeenCalledWith("export-1");
    });
  });

  it("requires tenant consent before creating institution review invites", async () => {
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Institution review invites/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Send review invite/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Recipient email/i), {
      target: { value: "reviewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Organization/i), {
      target: { value: "Example Insurance" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Preview access/i }));
    await waitFor(() => {
      expect(tenantInstitutionAccessApi.previewTenantInstitutionAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "insurer",
          recipient: expect.objectContaining({ email: "reviewer@example.com" }),
          expiresInDays: 14,
          consentAccepted: false,
        })
      );
    });
    expect(await screen.findByText(/No claims are accessible until consent and policy checks pass/i)).toBeInTheDocument();
    expect(screen.getByText(/Public trust profiles and public links are not created/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/I consent to inviting this recipient/i));
    fireEvent.click(screen.getByRole("button", { name: /Send review invite/i }));
    await waitFor(() => {
      expect(tenantInstitutionAccessApi.createInstitutionReviewInvite).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "insurer",
          consentAccepted: true,
          recipient: expect.objectContaining({ email: "reviewer@example.com" }),
        })
      );
    });
    expect(await screen.findByText(/Tenant portability metadata available/i)).toBeInTheDocument();
    expect(screen.getByText(/Invited/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Delivery/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sent/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Delivery attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilot status/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Review escalated/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Operational follow-up/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery emails contain only the review context and sign-in requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Access activity/i)).toBeInTheDocument();
    expect(screen.getByText(/re\*\*\*@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Opened reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked attempts/i)).toBeInTheDocument();
    expect(screen.getAllByText(/recipient email mismatch/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Review opened/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Review blocked/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/policyDecisions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rawProviderPayload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supportMetadataIncluded/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verified tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reputation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send to institution/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Resend delivery/i }));
    await waitFor(() => {
      expect(tenantInstitutionAccessApi.resendInstitutionReviewDelivery).toHaveBeenCalledWith("grant-1");
    });
    expect(await screen.findByText(/^Resent$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Revoke access/i }));
    await waitFor(() => {
      expect(tenantInstitutionAccessApi.revokeTenantInstitutionAccessGrant).toHaveBeenCalledWith("grant-1");
    });
  });

  it("lets tenants prepare and void metadata-only institutional handoff drafts", async () => {
    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Institutional handoff drafts/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No data is sent automatically/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Institution connections are not enabled yet/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant-managed manual-release preparation only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send to institution/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit to bank/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect institution/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Institution type/i), {
      target: { value: "bank" },
    });
    fireEvent.change(screen.getByLabelText(/Display name \(optional\)/i), {
      target: { value: "  Example Bank Sandbox  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Prepare institutional handoff/i }));

    await waitFor(() => {
      expect(tenantPortalApi.createInstitutionalHandoffDraft).toHaveBeenCalledWith({
        institutionProfile: {
          institutionType: "bank",
          displayName: "  Example Bank Sandbox  ",
          integrationMode: "sandbox",
        },
      });
    });

    expect(await screen.findByText(/^Ready for manual review$/i)).toBeInTheDocument();
    expect(screen.getByText(/Example Bank Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/ready for manual review before any tenant-managed sharing decision/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You may manually share a downloaded export outside RentChain when you choose/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/ready to send/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delivered/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Void draft/i }));
    await waitFor(() => {
      expect(tenantPortalApi.voidInstitutionalHandoffDraft).toHaveBeenCalledWith("handoff-1");
    });
    expect(await screen.findByText(/^Voided$/i)).toBeInTheDocument();
  });

  it("lets tenants approve a pending share access request", async () => {
    tenantSharePackagesApi.listTenantSharePackages.mockResolvedValue([
      {
        id: "share-1",
        createdAt: 1710000000000,
        expiresAt: 1710600000000,
        status: "active",
        permissions: {
          identitySummary: true,
          credibilitySummary: false,
          applicationSummary: false,
          documents: "none",
          leaseSummary: false,
          paymentReadinessSummary: false,
        },
        requestedItems: ["credibility_summary", "documents_summary"],
        approvedItems: [],
        verificationRequests: [
          {
            requestId: "req-1",
            requestedByType: "landlord",
            requestedScopes: ["lease_summary", "payment_readiness_summary"],
            status: "requested",
            createdAt: 1710000000000,
          },
        ],
        identityExchangeReference: {
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
          referenceLabel: "Identity exchange available",
          referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
          portabilityStatus: "ready",
          exchangeReadiness: {
            identityReady: true,
            credibilityReady: true,
            sharingControlsReady: true,
            auditTimelineReady: true,
            paymentReadinessAvailable: true,
          },
        },
      },
    ]);

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Approve requested access/i })).toBeInTheDocument();
    expect(screen.getByText(/Credibility summary, Documents summary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Approve requested access/i }));

    await waitFor(() => {
      expect(tenantSharePackagesApi.respondToTenantSharePackage).toHaveBeenCalledWith("share-1", [
        "credibility_summary",
        "documents_summary",
      ]);
    });
    expect(await screen.findByText(/Approved: Credibility summary, Documents summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity exchange available/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Reuse path: This link can support summary-only follow-through today\. Broader reuse still requires your approval\./i
      )
    ).toBeInTheDocument();
  });

  it("lets tenants approve and revoke verification requests", async () => {
    tenantSharePackagesApi.listTenantSharePackages.mockResolvedValue([
      {
        id: "share-1",
        createdAt: 1710000000000,
        expiresAt: 1710600000000,
        status: "active",
        permissions: {
          identitySummary: true,
          credibilitySummary: false,
          applicationSummary: false,
          documents: "none",
          leaseSummary: false,
          paymentReadinessSummary: false,
        },
        requestedItems: [],
        approvedItems: [],
        verificationRequests: [
          {
            requestId: "req-1",
            requestedByType: "landlord",
            requestedScopes: ["lease_summary", "payment_readiness_summary"],
            status: "requested",
            createdAt: 1710000000000,
          },
        ],
        identityExchangeReference: {
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
          referenceLabel: "Identity exchange available",
          referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
          portabilityStatus: "ready",
          exchangeReadiness: {
            identityReady: true,
            credibilityReady: true,
            sharingControlsReady: true,
            auditTimelineReady: true,
            paymentReadinessAvailable: true,
          },
        },
      },
    ]);
    tenantSharePackagesApi.respondToTenantShareVerificationRequest.mockResolvedValue({
      id: "share-1",
      createdAt: 1710000000000,
      expiresAt: 1710600000000,
      status: "active",
      permissions: {
        identitySummary: true,
        credibilitySummary: false,
        applicationSummary: false,
        documents: "none",
        leaseSummary: false,
        paymentReadinessSummary: true,
      },
      requestedItems: [],
      approvedItems: ["payment_readiness_summary"],
      verificationRequests: [
        {
          requestId: "req-1",
          requestedByType: "landlord",
          requestedScopes: ["payment_readiness_summary"],
          status: "approved",
          createdAt: 1710000000000,
        },
      ],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
        exchangeReadiness: {
          identityReady: true,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: true,
          paymentReadinessAvailable: true,
        },
      },
    });
    tenantSharePackagesApi.revokeTenantShareVerificationRequest.mockResolvedValue({
      id: "share-1",
      createdAt: 1710000000000,
      expiresAt: 1710600000000,
      status: "active",
      permissions: {
        identitySummary: true,
        credibilitySummary: false,
        applicationSummary: false,
        documents: "none",
        leaseSummary: false,
        paymentReadinessSummary: false,
      },
      requestedItems: [],
      approvedItems: [],
      verificationRequests: [
        {
          requestId: "req-1",
          requestedByType: "landlord",
          requestedScopes: ["payment_readiness_summary"],
          status: "revoked",
          createdAt: 1710000000000,
        },
      ],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
        exchangeReadiness: {
          identityReady: true,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: true,
          paymentReadinessAvailable: true,
        },
      },
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Approve request/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Approve request/i }));
    await waitFor(() => {
      expect(tenantSharePackagesApi.respondToTenantShareVerificationRequest).toHaveBeenCalledWith("share-1", "req-1", [
        "lease_summary",
        "payment_readiness_summary",
      ]);
    });

    expect(await screen.findByRole("button", { name: /Revoke request/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Revoke request/i }));
    await waitFor(() => {
      expect(tenantSharePackagesApi.revokeTenantShareVerificationRequest).toHaveBeenCalledWith("share-1", "req-1");
    });
  });

  it("shows an active-tenancy transition state when tenant access is active but the lease is not active yet", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: null,
      },
      maintenance: [],
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/transitioning into active tenancy/i)).toBeInTheDocument();
    expect(screen.getByText(/Transitioning to active tenancy/i)).toBeInTheDocument();
  });

  it("filters muted in-app document notifications from tenant views", async () => {
    tenantNotificationPreferencesApi.getTenantNotificationPreferences.mockResolvedValue({
      inApp: {
        follow_up_requested: true,
        ready_for_rereview: true,
        application_updated: true,
        access_changed: true,
        documents_updated: false,
      },
      updatedAt: 1710000000000,
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Recent workflow updates/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Documents updated$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Access changed$/i)).toBeInTheDocument();
  });

  it("renders application completion page with safe grouped checklist fields", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: {
        authority: "applicant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: null,
        tenantId: null,
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Applicant",
        property: null,
        application: {
          applicationId: "app-1",
          status: "in_progress",
          missingSteps: [],
          nextActions: [],
          createdAt: null,
          updatedAt: null,
        },
        lease: null,
      },
      identity: {
        overallStatus: "pending",
        identityVerification: {
          status: "pending",
          label: "Pending",
          note: "Verification is still in progress.",
          updatedAt: "2026-01-05T00:00:00.000Z",
        },
        documentChecklist: [],
        nextSteps: [],
      },
      actions: {
        editableFields: ["displayName", "phone"],
        documentEntry: {
          available: true,
          path: "/tenant/attachments",
          label: "Review requested documents",
          note: "1 document-related step still needs attention.",
        },
      },
    });
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "in_progress",
      progressPercent: 62,
      sections: [
        {
          key: "documents",
          label: "Documents",
          status: "missing",
          items: [
            {
              key: "upload_id",
              label: "Upload Id",
              status: "missing",
              nextAction: "Upload government id",
              actionPath: "/tenant/profile",
            },
          ],
        },
      ],
      nextSteps: ["Upload government id"],
      updatedAt: "2026-01-02T00:00:00.000Z",
      reminderTiming: "due_now",
      reminderTimingLabel: "Due now",
      reminderTimingDescription: "A current checklist step is ready for your attention now.",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByText(/Application Readiness/i)).not.toHaveLength(0);
    expect(screen.getByText(/Your application is in progress/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue your application/i })).toBeInTheDocument();
    expect(screen.getAllByText(/62%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Due now$/i)).toBeInTheDocument();
    expect(screen.getByText(/ready for your attention now/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Upload government id/i).length).toBeGreaterThan(0);
  });

  it("renders lease page with safe projected fields", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      status: "active",
      documentUrl: "https://example.com/lease.pdf",
      leaseDocumentContext: {
        leaseId: "lease-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        leaseStatus: "active",
        signingStatus: "signed",
        documentStatus: "signed",
        documentId: "snapshot-1",
        documentUrl: "https://example.com/lease.pdf",
        displayLabel: "Signed lease document",
        source: "lease_signed_document",
        confidence: "high",
        warnings: [],
      },
      scheduleADocumentContext: {
        leaseId: "lease-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        leaseStatus: "active",
        signingStatus: "signed",
        documentStatus: "generated",
        documentId: "snapshot-schedule-a",
        documentUrl: "https://example.com/schedule-a.pdf",
        displayLabel: "Schedule A",
        source: "leaseSnapshots/snapshot-schedule-a",
        confidence: "medium",
        warnings: [],
      },
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      signatureReadinessDescription: "The visible lease record shows the current signing stage as complete.",
      tenantSignature: {
        signedAt: "2026-02-01T10:00:00.000Z",
        signatureMethod: "drawn",
        signatureDisplayName: "Taylor Tenant",
      },
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "A tenant-safe lease document is available in this workspace.",
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "The visible lease record indicates the current execution flow is complete.",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-02-02T12:00:00.000Z",
      },
      paymentReadiness: {
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        readinessDescription:
          "The current lease shows the core rent terms and tenancy linkage needed for a future payment setup workflow, without enabling any payment activity today.",
        requiredNextAction: "confirm_payment_setup_later",
        rentTerms: {
          rentAmountAvailable: true,
          dueDateAvailable: true,
          leaseDatesAvailable: true,
          tenantLinked: true,
          leaseExecuted: true,
        },
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      },
      rentPaymentSummary: {
        paymentRail: {
          enabled: true,
          enabledAt: "2026-04-27T10:00:00.000Z",
          processor: "stripe",
          blockedReason: null,
        },
        latestPayment: null,
      },
    });

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Lease Summary$/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,800/i)).toBeInTheDocument();
    expect(screen.getByText(/^Lease signing complete$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Signed lease document$/i)).toBeInTheDocument();
    expect(screen.getByText(/Document status: Signed/i)).toBeInTheDocument();
    expect(screen.getByText(/^Lease fully executed$/i)).toBeInTheDocument();
    expect(screen.getByText(/Rent terms ready for future setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment processed by Stripe\. RentChain does not store card or bank payment details\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay rent/i })).toBeInTheDocument();
    expect(screen.getByText(/^Drawn signature$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Taylor Tenant$/i)).toBeInTheDocument();
    const openLeaseButton = screen.getByRole("button", { name: /View lease/i });
    expect(openLeaseButton).toBeInTheDocument();
    fireEvent.click(openLeaseButton);
    await waitFor(() => expect(tenantPortalApi.refreshTenantLeaseDocumentUrl).toHaveBeenCalled());
    expect(window.open).toHaveBeenCalledWith("https://example.com/refreshed-lease.pdf", "_blank", "noreferrer");
    tenantPortalApi.refreshTenantLeaseDocumentUrl.mockResolvedValueOnce({
      documentUrl: "https://example.com/refreshed-schedule-a.pdf",
      displayLabel: "Schedule A",
      documentStatus: "generated",
      source: "leaseSnapshots/snapshot-schedule-a",
      expiresInSeconds: 1800,
    });
    fireEvent.click(screen.getByRole("button", { name: /Open Schedule A/i }));
    await waitFor(() =>
      expect(tenantPortalApi.refreshTenantLeaseDocumentUrl).toHaveBeenCalledWith({ document: "schedule-a" })
    );
    expect(window.open).toHaveBeenCalledWith("https://example.com/refreshed-schedule-a.pdf", "_blank", "noreferrer");
  });

  it("does not open stale tenant GCS lease URLs when refresh fails", async () => {
    tenantPortalApi.refreshTenantLeaseDocumentUrl.mockRejectedValueOnce(new Error("refresh failed"));
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-stale",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1800,
      status: "active",
      documentUrl:
        "https://storage.googleapis.com/lease-documents/leases/PXbRIbJdZpV2eBjzNmLaISgDa852/nkzRYxdZ49p0IGdXD3mS/schedule-a-v1.pdf?X-Goog-Expires=1",
      leaseDocumentContext: {
        leaseId: "lease-stale",
        documentUrl:
          "https://storage.googleapis.com/lease-documents/leases/PXbRIbJdZpV2eBjzNmLaISgDa852/nkzRYxdZ49p0IGdXD3mS/schedule-a-v1.pdf?X-Goog-Expires=1",
        displayLabel: "Signed lease document",
        documentStatus: "signed",
        source: "lease.documentUrl",
        confidence: "high",
        warnings: [],
      },
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      signatureReadinessDescription: "The visible lease record shows the current signing stage as complete.",
      tenantSignature: {
        signedAt: "2026-03-02T12:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Taylor Tenant",
      },
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "A tenant-safe lease document is available in this workspace.",
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "The lease is fully executed.",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-03-02T12:00:00.000Z",
      },
    } as any);

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    vi.mocked(window.open).mockClear();
    expect(screen.queryByRole("button", { name: /Open lease document/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Schedule A \/ attachment/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Open Schedule A/i }));
    await waitFor(() =>
      expect(tenantPortalApi.refreshTenantLeaseDocumentUrl).toHaveBeenCalledWith({ document: "schedule-a" })
    );
    expect(window.open).not.toHaveBeenCalled();
    expect(await screen.findByText("refresh failed")).toBeInTheDocument();
  });

  it("does not open Schedule A when the tenant primary lease refresh path returns it", async () => {
    tenantPortalApi.refreshTenantLeaseDocumentUrl.mockResolvedValueOnce({
      documentUrl: "https://storage.googleapis.com/lease-documents/leases/landlord/draft/schedule-a-v1.pdf",
      displayLabel: "Signed lease document",
      documentStatus: "signed",
      source: "leaseDocument",
      expiresInSeconds: 1800,
    });
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-tenant-primary",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1800,
      status: "active",
      documentUrl: "https://example.com/lease.pdf",
      leaseDocumentContext: {
        leaseId: "lease-tenant-primary",
        documentUrl: "https://example.com/lease.pdf",
        displayLabel: "Signed lease document",
        documentStatus: "signed",
        source: "lease.documentUrl",
        confidence: "high",
        warnings: [],
      },
      scheduleADocumentContext: {
        leaseId: "lease-tenant-primary",
        documentUrl: "https://example.com/schedule-a.pdf",
        displayLabel: "Schedule A",
        documentStatus: "generated",
        source: "leaseSnapshots/snapshot-schedule-a",
        confidence: "high",
        warnings: [],
      },
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "The lease is fully executed.",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-03-02T12:00:00.000Z",
      },
    } as any);

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    vi.mocked(window.open).mockClear();
    fireEvent.click(await screen.findByRole("button", { name: /View lease/i }));
    await waitFor(() => expect(tenantPortalApi.refreshTenantLeaseDocumentUrl).toHaveBeenCalledWith());
    expect(window.open).not.toHaveBeenCalled();
  });

  it("shows the tenant lease sign action only when backend execution metadata requires it", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-2",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1900,
      status: "ready_for_signature",
      documentUrl: "https://example.com/sign.pdf",
      signatureStatus: "awaiting_tenant_signature",
      signatureReadinessLabel: "Awaiting tenant signature",
      signatureReadinessDescription: "A tenant-safe lease document is available, and the next visible signing step belongs to the tenant.",
      tenantSignature: null,
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "A tenant-safe lease document is available in this workspace.",
      leaseExecution: {
        executionStatus: "ready_for_tenant_signature",
        executionLabel: "Waiting for tenant signature",
        executionDescription: "The lease document is ready and the next execution step belongs to the tenant.",
        requiredNextAction: "tenant_signature",
        tenantSignatureStatus: "needed",
        landlordSignatureStatus: "blocked",
        pdfStatus: "generated",
        completedAt: null,
      },
    });
    tenantPortalApi.signTenantLease.mockResolvedValue({
      leaseId: "lease-2",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1900,
      status: "ready_for_signature",
      documentUrl: "https://example.com/sign.pdf",
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      signatureReadinessDescription: "The visible lease record shows the current signing stage as complete.",
      tenantSignature: {
        signedAt: "2026-03-02T12:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Taylor Tenant",
      },
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "A tenant-safe lease document is available in this workspace.",
      leaseExecution: {
        executionStatus: "tenant_signed",
        executionLabel: "Tenant signature completed",
        executionDescription: "Tenant signature is recorded. The next supported execution step depends on landlord follow-through.",
        requiredNextAction: "landlord_signature",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "needed",
        pdfStatus: "generated",
        completedAt: null,
      },
    });

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Confirm tenant signature/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm tenant signature/i }));

    await waitFor(() => expect(tenantPortalApi.signTenantLease).toHaveBeenCalledWith("lease-2"));
    expect(await screen.findByText(/^Tenant signature completed$/i)).toBeInTheDocument();
  });

  it("starts tenant checkout from the lease page when rent collection is enabled", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      status: "active",
      documentUrl: "https://example.com/lease.pdf",
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      signatureReadinessDescription: "Complete.",
      tenantSignature: {
        signedAt: "2026-02-01T10:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Taylor Tenant",
      },
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "Available.",
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "Complete.",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-02-02T12:00:00.000Z",
      },
      paymentReadiness: {
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        readinessDescription: "Ready.",
        requiredNextAction: "confirm_payment_setup_later",
        rentTerms: {
          rentAmountAvailable: true,
          dueDateAvailable: true,
          leaseDatesAvailable: true,
          tenantLinked: true,
          leaseExecuted: true,
        },
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      },
      rentPaymentSummary: {
        paymentRail: {
          enabled: true,
          enabledAt: "2026-04-27T10:00:00.000Z",
          processor: "stripe",
          blockedReason: null,
        },
        latestPayment: null,
      },
    });

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Pay rent/i }));

    await waitFor(() => {
      expect(tenantPortalApi.createTenantLeasePaymentCheckout).toHaveBeenCalledWith("lease-1");
    });
  });

  it("maps checkout blocker errors to tenant-safe rent guidance", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: {
        leaseId: "lease-1",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyRent: 1800,
        status: "active",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription: "Ready.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: true,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        rentPaymentSummary: {
          paymentRail: {
            enabled: true,
            enabledAt: "2026-04-27T10:00:00.000Z",
            processor: "stripe",
            blockedReason: null,
          },
          latestPayment: null,
        },
      },
      maintenance: [],
      tenantIdentityRecord: null,
      tenantCredibilitySignals: null,
      identityTimeline: { events: [] },
    });
    tenantPortalApi.createTenantLeasePaymentCheckout.mockRejectedValue({
      payload: { detail: "payment_already_pending" },
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Pay rent/i }));

    expect(
      await screen.findByText(/A checkout is already open for this lease\. Finish the existing checkout or wait for its status to update\./i)
    ).toBeInTheDocument();
  });

  it("renders tenant lease payment history, retry state, and print-safe summary", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      status: "active",
      documentUrl: "https://example.com/lease.pdf",
      signatureStatus: "signed",
      signatureReadinessLabel: "Lease signing complete",
      signatureReadinessDescription: "Complete.",
      tenantSignature: {
        signedAt: "2026-02-01T10:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Taylor Tenant",
      },
      leasePdfStatus: "available",
      leasePdfLabel: "Lease document available",
      leasePdfDescription: "Available.",
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "Complete.",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-02-02T12:00:00.000Z",
      },
      paymentReadiness: {
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        readinessDescription: "Ready.",
        requiredNextAction: "confirm_payment_setup_later",
        rentTerms: {
          rentAmountAvailable: true,
          dueDateAvailable: true,
          leaseDatesAvailable: true,
          tenantLinked: true,
          leaseExecuted: true,
        },
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      },
      rentPaymentSummary: {
        paymentRail: {
          enabled: true,
          enabledAt: "2026-04-27T10:00:00.000Z",
          processor: "stripe",
          blockedReason: null,
        },
        latestPayment: null,
      },
    });
    tenantPortalApi.getTenantLeasePaymentStatus.mockResolvedValueOnce({
      paymentRail: {
        enabled: true,
        enabledAt: "2026-04-27T10:00:00.000Z",
        processor: "stripe",
        blockedReason: null,
      },
      latestPayment: {
        id: "rp-2",
        amountCents: 180000,
        currency: "cad",
        status: "expired",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:00.000Z",
        paidAt: null,
      },
      paymentExperience: {
        history: [
          {
            id: "rp-2",
            amountCents: 180000,
            currency: "cad",
            status: "expired",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
            paidAt: null,
          },
          {
            id: "rp-1",
            amountCents: 180000,
            currency: "cad",
            status: "paid",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            paidAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        latestStatus: "canceled",
        retryAvailable: true,
        receiptSummary: {
          available: true,
          label: "Payment summary available",
          amountCents: 180000,
          paidAt: "2026-03-20T00:00:00.000Z",
          leaseReference: "lease-1",
        },
      },
    });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Payment history/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Checkout expired$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/The checkout expired before payment completed\. Start a new checkout to try again\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry payment/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Print \/ Save payment summary/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("renders maintenance page with safe projected data", async () => {
    maintenanceWorkflowApi.listTenantMaintenance.mockResolvedValue({
      items: [
        {
          id: "maint-1",
          title: "Leaky tap",
          status: "submitted",
          priority: "normal",
          category: "general",
          createdAt: 100,
          updatedAt: 200,
        },
      ],
    });

    render(
      <MemoryRouter>
        <TenantMaintenanceRequestsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Maintenance$/i)).toBeInTheDocument();
    expect(screen.getByText(/Leaky tap/i)).toBeInTheDocument();
  });

  it("invite redemption page handles success state", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "invite",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: null,
        leaseId: null,
        tenantId: null,
        unitId: "unit-1",
        invitedEmail: "tenant@example.com",
      },
      property: null,
      application: null,
      lease: null,
      maintenance: [],
    });
    tenantPortalApi.redeemTenantWorkspaceInvite.mockResolvedValue({
      inviteId: "invite-1",
      propertyId: "prop-1",
      applicationId: "app-1",
      rc_prop_id: "rc-prop-1",
      status: "redeemed",
    });

    render(
      <MemoryRouter>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/You are completing your invite/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Complete your invite/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Invite token/i }), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Redeem invite/i }));

    expect(await screen.findByText(/Invite redeemed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue to application readiness/i })).toHaveAttribute(
      "href",
      "/tenant/application?entry=invite&inviteToken=app-1"
    );
  });

  it("invite redemption page handles expired or reused states", async () => {
    tenantPortalApi.redeemTenantWorkspaceInvite.mockRejectedValue({
      payload: { error: "invite_expired" },
      message: "invite_expired",
    });

    render(
      <MemoryRouter>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Invite token/i }), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Redeem invite/i }));

    expect(await screen.findByText(/This invite has expired/i)).toBeInTheDocument();
  });

  it("invite redemption page prefills token from the route query", async () => {
    render(
      <MemoryRouter initialEntries={["/tenant/invite/redeem?token=token-123"]}>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("textbox", { name: /Invite token/i })).toHaveValue("token-123");
  });

  it("unauthorized workspace response renders safe denial state", async () => {
    tenantPortalApi.getTenantWorkspace.mockRejectedValue({
      payload: { error: "FORBIDDEN" },
      message: "FORBIDDEN",
    });

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/cannot open this dashboard/i)).toBeInTheDocument();
  });

  it("empty state renders safely for application and maintenance", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue(null);
    maintenanceWorkflowApi.listTenantMaintenance.mockResolvedValue({ items: [] });

    const applicationRender = render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No application checklist yet/i)).toBeInTheDocument();
    applicationRender.unmount();

    render(
      <MemoryRouter>
        <TenantMaintenanceRequestsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No maintenance requests yet/i)).toBeInTheDocument();
  });
});
