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

vi.mock("../../api/tenantApplicationCompletion", () => tenantApplicationCompletionApi);
vi.mock("../../api/tenantProfile", () => tenantProfileApi);
vi.mock("../../api/tenantAttachmentsApi", () => tenantAttachmentsApi);
vi.mock("../../api/tenantAccess", () => tenantAccessApi);

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
    expect(screen.getAllByText(/62%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Flow Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Needs attention before review/i)).toBeInTheDocument();
    expect(screen.getByText(/Invite entry/i)).toBeInTheDocument();
    expect(screen.getByText(/^Next step$/i)).toBeInTheDocument();
    expect(screen.getByText(/Application Readiness Summary/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Use Your Saved Profile/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Document Readiness/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Review Before Sharing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Identity verification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Upload income documents/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Review your profile/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open documents/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Review access/i }).length).toBeGreaterThan(0);
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
});
