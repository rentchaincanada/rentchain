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
    });
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
    tenantSharePackagesApi.createTenantSharePackage.mockResolvedValue({
      id: "share-1",
      createdAt: 1710000000000,
      expiresAt: 1710600000000,
      status: "active",
      shareUrl: "https://app.example/share/share-token-1",
    });
    tenantSharePackagesApi.revokeTenantSharePackage.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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
    expect(screen.getByText(/Ready to apply/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing pieces/i)).toBeInTheDocument();
    expect(screen.getByText(/Income documents/i)).toBeInTheDocument();
    expect(screen.getByText(/Share Your Rental Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Add missing details to keep your rental profile organized/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View your profile/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Applicant$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Active tenancy/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/A lease reference is visible in your tenant workspace/i)).toBeInTheDocument();
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

  it("lets tenants generate, copy, and revoke share links", async () => {
    tenantSharePackagesApi.listTenantSharePackages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "share-1",
          createdAt: 1710000000000,
          expiresAt: 1710600000000,
          status: "active",
        },
      ]);

    render(
      <MemoryRouter>
        <TenantWorkspacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Share Your Rental Profile/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Generate share link/i }));

    expect(await screen.findByTestId("fresh-share-url")).toHaveTextContent("https://app.example/share/share-token-1");
    expect(tenantSharePackagesApi.createTenantSharePackage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Copy latest link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://app.example/share/share-token-1");

    fireEvent.click(screen.getByRole("button", { name: /Revoke link/i }));
    await waitFor(() => {
      expect(tenantSharePackagesApi.revokeTenantSharePackage).toHaveBeenCalledWith("share-1");
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
    });

    render(
      <MemoryRouter>
        <TenantLeasePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Lease Summary$/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,800/i)).toBeInTheDocument();
    expect(screen.getByText(/^Lease signing complete$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Lease document available$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Drawn signature$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Taylor Tenant$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open lease document/i })).toBeInTheDocument();
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
