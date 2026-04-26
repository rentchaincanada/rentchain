import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantApplicationStatusPage from "./TenantApplicationStatusPage";

const tenantApplicationCompletionApi = vi.hoisted(() => ({
  getTenantApplicationCompletion: vi.fn(),
}));

const tenantProfileApi = vi.hoisted(() => ({
  getTenantProfile: vi.fn(),
}));

const tenantAttachmentsApi = vi.hoisted(() => ({
  getTenantAttachments: vi.fn(),
}));

const tenantAccessApi = vi.hoisted(() => ({
  getTenantAccess: vi.fn(),
}));

const tenantNotificationPreferencesApi = vi.hoisted(() => ({
  getTenantNotificationPreferences: vi.fn(),
}));

const tenantPortalApi = vi.hoisted(() => ({
  getTenantLeaseWorkspace: vi.fn(),
}));

vi.mock("../../api/tenantApplicationCompletion", () => tenantApplicationCompletionApi);
vi.mock("../../api/tenantProfile", () => tenantProfileApi);
vi.mock("../../api/tenantAttachmentsApi", () => tenantAttachmentsApi);
vi.mock("../../api/tenantAccess", () => tenantAccessApi);
vi.mock("../../api/tenantNotificationPreferences", () => tenantNotificationPreferencesApi);
vi.mock("../../api/tenantPortal", () => tenantPortalApi);

describe("tenant application completion page", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "applicant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Applicant",
        property: {
          street1: "123 Main St",
          street2: "Unit 4",
          city: "Halifax",
          province: "NS",
        },
        application: { status: "submitted", missingSteps: [], nextActions: [] },
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
          label: "Open documents",
          note: "Open your tenant documents area.",
        },
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
    tenantAccessApi.getTenantAccess.mockResolvedValue({
      summary: {
        activeGrants: 1,
        pendingRequests: 0,
        latestActivityAt: 1710000000000,
      },
      pendingRequests: [],
      activeAccess: [
        {
          id: "share-1",
          grantedToLabel: "Shared with your landlord",
          categories: ["Rental history"],
          status: "active",
          grantedAt: 1710000000000,
          expiresAt: 1711000000000,
          lastActivityAt: 1710000000000,
          canRevoke: true,
          accessLabel: "View-only access",
        },
      ],
      recentActivity: [],
      guidance: {
        headline: "You can review and manage the access you’ve already shared.",
        body: "This view shows tenant-safe sharing records only.",
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
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue(null);
  });

  it("renders progress and grouped checklist safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "in_progress",
      progressPercent: 62,
      sections: [
        {
          key: "identity",
          label: "Identity",
          status: "verified",
          items: [
            {
              key: "identity_verification",
              label: "Identity verification",
              status: "verified",
              nextAction: null,
              actionPath: null,
              actionLabel: null,
            },
          ],
        },
        {
          key: "documents",
          label: "Documents",
          status: "missing",
          items: [
            {
              key: "income_documents",
              label: "Income documents",
              status: "missing",
              nextAction: "Upload income documents",
              actionPath: "/tenant/attachments",
              actionLabel: "Open documents",
            },
          ],
        },
      ],
      nextSteps: ["Upload income documents"],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/tenant/application?entry=invite&inviteToken=invite-1"]}>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByText(/Application Readiness/i)).not.toHaveLength(0);
    expect(screen.getByText(/Your application is in progress/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue your application/i })).toBeInTheDocument();
    expect(screen.getAllByText(/62%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Flow Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Needs attention before review/i)).toBeInTheDocument();
    expect(screen.getByText(/Invite entry/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Next step$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Application Readiness Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent activity \/ notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent workflow updates/i)).toBeInTheDocument();
    expect(screen.getByText(/Share Package/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Profile details/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rental history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Documents & records/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Consent \/ identity status/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Application readiness/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Structured Follow-up/i)).toBeInTheDocument();
    expect(screen.getByText(/Still needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/^Addressed$/i)).toBeInTheDocument();
    expect(screen.getByText(/Application ready for re-review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Decision outcome/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hold for later/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Lease step$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not ready for lease step/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lease preparation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not started/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Move-in readiness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Lease execution$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What happens next/i)).toBeInTheDocument();
    expect(screen.getByText(/This handoff view shows whether your file is ready to move into the next lease step/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Blockers$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Lease signing$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Who is expected to act/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not ready for signing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deposit \/ first payment/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What this payment covers/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not requested/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What this means/i)).toBeInTheDocument();
    expect(screen.getByText(/derived from your current follow-up and re-review state/i)).toBeInTheDocument();
    expect(screen.getByText(/Go next/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Review Before Sharing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Identity verification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Upload income documents/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Review your profile/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open documents/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Review access/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Review again/i }).length).toBeGreaterThan(0);
  });

  it("shows lease-step-started state when a lease workspace record is visible", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      monthlyRent: 180000,
      status: "draft",
      documentUrl: null,
    });
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "completed",
      progressPercent: 100,
      sections: [],
      nextSteps: [],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Lease step/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Lease step started/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Lease preparation/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Preparing lease/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open lease details/i }).length).toBeGreaterThan(0);
  });

  it("shows ready-for-execution preparation when the lease document is already visible", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      monthlyRent: 180000,
      status: "draft",
      documentUrl: "https://example.com/lease.pdf",
    });
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "completed",
      progressPercent: 100,
      sections: [],
      nextSteps: [],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Lease preparation/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Ready for execution/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/A lease document is already visible in the current workspace/i).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Move-in readiness/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Ready for move-in/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/^Lease execution$/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Execution in progress/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/^Lease signing$/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Signing in progress/i)).length).toBeGreaterThan(0);
  });

  it("shows requested payment details when a signed lease has an outstanding deposit", async () => {
    tenantPortalApi.getTenantLeaseWorkspace.mockResolvedValue({
      leaseId: "lease-1",
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      monthlyRent: 1800,
      status: "signed",
      documentUrl: "https://example.com/lease.pdf",
      depositCents: 150000,
      depositRequired: true,
    });
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "completed",
      progressPercent: 100,
      sections: [],
      nextSteps: [],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Deposit \/ first payment/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Payment requested/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Requested amount: \$1,500.00 deposit/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open payments/i }).length).toBeGreaterThan(0);
  });

  it("renders empty state safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No application checklist yet/i)).toBeInTheDocument();
  });

  it("renders error state safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockRejectedValue(new Error("Unable to load application completion."));

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/We couldn't load this view/i)).toBeInTheDocument();
    expect(screen.getByText(/Unable to load application completion/i)).toBeInTheDocument();
  });

  it("respects muted document update notifications", async () => {
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
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "in_progress",
      progressPercent: 40,
      sections: [],
      nextSteps: [],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Recent workflow updates/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Documents updated$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Access changed$/i)).toBeInTheDocument();
  });
});
