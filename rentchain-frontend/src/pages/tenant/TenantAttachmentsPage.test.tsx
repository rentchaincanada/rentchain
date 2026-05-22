import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantAttachmentsPage from "./TenantAttachmentsPage";

const tenantAttachmentsApi = vi.hoisted(() => ({
  getTenantAttachments: vi.fn(),
}));

const tenantAccessApi = vi.hoisted(() => ({
  getTenantAccess: vi.fn(),
}));

vi.mock("../../api/tenantAttachmentsApi", () => tenantAttachmentsApi);
vi.mock("../../api/tenantAccess", () => tenantAccessApi);

describe("tenant attachments page", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantAccessApi.getTenantAccess.mockResolvedValue({
      summary: {
        activeGrants: 1,
        pendingRequests: 0,
        latestActivityAt: 1710001000000,
      },
      pendingRequests: [],
      activeAccess: [
        {
          id: "share-1",
          grantedToLabel: "Shared with your landlord for 123 Main St",
          categories: ["Rental history"],
          status: "active",
          grantedAt: 1710000000000,
          expiresAt: 1711000000000,
          lastActivityAt: 1710001000000,
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

  it("renders empty state correctly", async () => {
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
        <TenantAttachmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No documents in your vault yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add documents to your profile/i })).toBeInTheDocument();
  });

  it("renders grouped status-aware document items and guidance", async () => {
    tenantAttachmentsApi.getTenantAttachments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "doc-1",
          label: "Income documents",
          category: "Income",
          status: "reupload_requested",
          fileName: "paystub.pdf",
          url: "https://example.com/paystub.pdf",
          uploadedAt: 1710000000000,
          nextAction: "Please upload a clearer income document.",
          helpLabel: "Open messages",
          helpPath: "/tenant/messages",
        },
        {
          id: "doc-2",
          label: "Government ID",
          category: "Identity",
          status: "pending_review",
          fileName: "id-card.pdf",
          url: "https://example.com/id-card.pdf",
          uploadedAt: 1710001000000,
          nextAction: "Your document has been added and is waiting for review.",
          helpLabel: null,
          helpPath: null,
        },
      ],
      summary: {
        total: 2,
        missing: 0,
        uploaded: 0,
        pendingReview: 1,
        verified: 0,
        needsAttention: 1,
      },
      guidance: {
        headline: "Some documents need attention before your application can move forward smoothly.",
        nextSteps: ["Please upload a clearer income document."],
        uploadEntryAvailable: false,
        uploadEntryLabel: null,
        uploadEntryPath: null,
        supportPath: "/tenant/messages",
        supportLabel: "Message your landlord",
      },
      updatedAt: 1710001000000,
    });

    render(
      <MemoryRouter>
        <TenantAttachmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Document Vault Summary/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ready to share/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sharing Visibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Some documents need attention/i)).toBeInTheDocument();
    expect(screen.getByText(/Re-upload requested/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pending review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open file/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Message your landlord/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review sharing/i })).toBeInTheDocument();
    expect(screen.getByText(/Direct upload is not available from this page yet/i)).toBeInTheDocument();
  });

  it("does not render a zero-document vault when tenant-safe lease attachments are available", async () => {
    tenantAttachmentsApi.getTenantAttachments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "schedule-a-context-lease-1",
          label: "SCHEDULE_A — Schedule A",
          category: "Attachments",
          status: "uploaded",
          title: "Schedule A",
          fileName: "schedule-a.pdf",
          url: "https://signed.example/schedule-a.pdf",
          uploadedAt: 1710002000000,
          nextAction: "This file has been added to your record.",
          purpose: "SCHEDULE_A",
          purposeLabel: "Schedule A",
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
      updatedAt: 1710002000000,
    });

    render(
      <MemoryRouter>
        <TenantAttachmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Document Vault Summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/No documents in your vault yet/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Schedule A/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/schedule-a\.pdf/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open file/i })).toHaveAttribute("href", "https://signed.example/schedule-a.pdf");
    expect(screen.queryByText(/support-operator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/realActorId/i)).not.toBeInTheDocument();
  });

  it("renders unauthorized state safely", async () => {
    tenantAttachmentsApi.getTenantAttachments.mockRejectedValue({ message: "FORBIDDEN" });

    render(
      <MemoryRouter>
        <TenantAttachmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Access unavailable/i)).toBeInTheDocument();
  });
});
