import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantProfilePage from "./TenantProfilePage";
import TenantMessagesCenterPage from "./TenantMessagesCenterPage";
import TenantActivityPage from "./TenantActivityPage";
import { TenantNav } from "../../components/layout/TenantNav";

const tenantProfileApi = vi.hoisted(() => ({
  getTenantProfile: vi.fn(),
  updateTenantProfile: vi.fn(),
}));

const tenantAttachmentsApi = vi.hoisted(() => ({
  getTenantAttachments: vi.fn(),
}));

const tenantCommunicationsApi = vi.hoisted(() => ({
  getTenantCommunicationSummary: vi.fn(),
  getTenantCommunicationsWorkspace: vi.fn(),
  sendTenantCommunicationMessage: vi.fn(),
  markTenantCommunicationsRead: vi.fn(),
}));

const tenantNotificationsApi = vi.hoisted(() => ({
  getTenantNotifications: vi.fn(),
}));

const tenantPortalApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
}));

vi.mock("../../api/tenantProfile", () => tenantProfileApi);
vi.mock("../../api/tenantAttachmentsApi", () => tenantAttachmentsApi);
vi.mock("../../api/tenantCommunicationsApi", () => tenantCommunicationsApi);
vi.mock("../../api/tenantNotifications", () => tenantNotificationsApi);
vi.mock("../../api/tenantPortal", () => tenantPortalApi);

describe("tenant profile and communications pages", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "unit-2",
        invitedEmail: "tenant@example.com",
      },
    });
    tenantAttachmentsApi.getTenantAttachments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "doc-1",
          label: "Upload Id",
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
    tenantCommunicationsApi.getTenantCommunicationSummary.mockResolvedValue({
      unreadMessages: 1,
      unreadNotices: 0,
      unreadScreeningUpdates: 0,
    });
  });

  it("tenant nav integrates profile and feed links coherently", async () => {
    render(
      <MemoryRouter>
        <TenantNav>
          <div>Tenant content</div>
        </TenantNav>
      </MemoryRouter>
    );

    expect(await screen.findByText(/RentChain Tenant Space/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Access/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /History/i })).toBeInTheDocument();
  });

  it("tenant profile page renders safe projected profile data and identity states", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Active tenant",
        property: {
          street1: "123 Main St",
          street2: "Unit 4",
          city: "Halifax",
          province: "NS",
        },
        application: { status: "submitted" },
        lease: { status: "active", monthlyRent: 1800, startDate: "2026-02-01", endDate: "2027-01-31", documentUrl: null },
      },
      identity: {
        overallStatus: "pending",
        identityVerification: {
          status: "pending",
          label: "Pending",
          note: "Verification is still in progress.",
          updatedAt: "2026-01-05T00:00:00.000Z",
        },
        documentChecklist: [{ code: "upload_id", label: "Upload Id", status: "missing", nextStep: "Upload government id" }],
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

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/This is your organized rental profile space/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile completion/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue(/Taylor Tenant/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Verification is still in progress/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: /Display name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Phone/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Rental record/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Employment and income/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Upload government id/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Save profile changes/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Document Vault/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open document vault/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Review requested documents/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open documents|Review documents/i }).length).toBeGreaterThan(0);
  });

  it("tenant profile page saves bounded profile edits safely", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Active tenant",
        property: null,
        application: null,
        lease: null,
      },
      identity: {
        overallStatus: "verified",
        identityVerification: {
          status: "verified",
          label: "Verified",
          note: "All set.",
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
    tenantProfileApi.updateTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Updated",
        email: "tenant@example.com",
        phone: "902-555-0111",
        authorityLabel: "Active tenant",
        property: null,
        application: null,
        lease: null,
      },
      identity: {
        overallStatus: "verified",
        identityVerification: {
          status: "verified",
          label: "Verified",
          note: "All set.",
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

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("Taylor Tenant")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Display name/i }), {
      target: { value: "Taylor Updated" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Phone/i }), {
      target: { value: "902-555-0111" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save profile changes/i }));

    expect(tenantProfileApi.updateTenantProfile).toHaveBeenCalledWith({
      displayName: "Taylor Updated",
      phone: "902-555-0111",
    });
    expect(await screen.findByText(/Profile details updated/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Taylor Updated")).toBeInTheDocument();
  });

  it("tenant profile page handles validation failure safely", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        authorityLabel: "Active tenant",
        property: null,
        application: null,
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
          available: false,
          path: null,
          label: "Open documents",
          note: null,
        },
      },
    });
    tenantProfileApi.updateTenantProfile.mockRejectedValue(new Error("TENANT_PROFILE_UPDATE_FAILED"));

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("Taylor Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save profile changes/i }));
    expect(await screen.findByText(/TENANT_PROFILE_UPDATE_FAILED/i)).toBeInTheDocument();
  });

  it("communications page handles empty state and compose/send success", async () => {
    tenantCommunicationsApi.getTenantCommunicationsWorkspace.mockResolvedValue({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        unreadCount: 0,
        lastMessageAt: null,
        propertyId: "prop-1",
        unitId: "unit-2",
        messages: [],
      },
    });
    tenantCommunicationsApi.markTenantCommunicationsRead.mockResolvedValue(undefined);
    tenantCommunicationsApi.sendTenantCommunicationMessage.mockResolvedValue({
      id: "msg-1",
      senderRole: "tenant",
      body: "Hello there",
      createdAt: "2026-01-06T00:00:00.000Z",
      createdAtMs: 1234,
    });

    render(
      <MemoryRouter>
        <TenantMessagesCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Once you or your landlord start a conversation/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Compose message/i }), {
      target: { value: "Hello there" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(tenantCommunicationsApi.sendTenantCommunicationMessage).toHaveBeenCalledWith("Hello there");
  });

  it("communications page handles send failure safely", async () => {
    tenantCommunicationsApi.getTenantCommunicationsWorkspace.mockResolvedValue({
      canSend: true,
      canSendReason: null,
      thread: {
        id: "thread-1",
        landlordLabel: "Landlord",
        unreadCount: 0,
        lastMessageAt: null,
        propertyId: "prop-1",
        unitId: "unit-2",
        messages: [],
      },
    });
    tenantCommunicationsApi.markTenantCommunicationsRead.mockResolvedValue(undefined);
    tenantCommunicationsApi.sendTenantCommunicationMessage.mockRejectedValue(new Error("Send failed"));

    render(
      <MemoryRouter>
        <TenantMessagesCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Once you or your landlord start a conversation/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Compose message/i }), {
      target: { value: "Hello there" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(await screen.findByText(/Send failed/i)).toBeInTheDocument();
  });

  it("notifications page renders safe feed items", async () => {
    tenantNotificationsApi.getTenantNotifications.mockResolvedValue([
      {
        id: "feed-1",
        type: "application",
        title: "Application status updated",
        summary: "Current application status: submitted.",
        createdAt: "2026-01-05T00:00:00.000Z",
        status: "info",
        relatedPath: "/tenant/application",
      },
    ]);

    render(
      <MemoryRouter>
        <TenantActivityPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Recent Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Timeline summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Application status updated/i)).toBeInTheDocument();
  });

  it("unauthorized profile state renders safely", async () => {
    tenantProfileApi.getTenantProfile.mockRejectedValue({ message: "FORBIDDEN" });
    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Access unavailable/i)).toBeInTheDocument();
  });
});
