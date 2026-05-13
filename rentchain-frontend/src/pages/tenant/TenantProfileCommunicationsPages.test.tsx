import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantProfilePage from "./TenantProfilePage";
import TenantMessagesCenterPage from "./TenantMessagesCenterPage";
import TenantActivityPage from "./TenantActivityPage";
import { formatDate } from "./TenantWorkspaceShared";
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
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    tenantPortalApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "iXHTFgm8ay3iuUptfI4I",
        invitedEmail: "tenant@example.com",
      },
      unit: {
        unitId: "iXHTFgm8ay3iuUptfI4I",
        label: "1",
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
    expect(screen.getByRole("link", { name: /Screening Requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Access/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /History/i })).toBeInTheDocument();
  });

  it("tenant nav shows the hydrated unit label instead of the raw unit id", async () => {
    render(
      <MemoryRouter>
        <TenantNav>
          <div>Tenant content</div>
        </TenantNav>
      </MemoryRouter>
    );

    expect(await screen.findByText((content) => content.includes("tenant@example.com") && content.includes("Unit 1"))).toBeInTheDocument();
    expect(screen.queryByText(/iXHTFgm8ay3iuUptfI4I/)).not.toBeInTheDocument();
  });

  it("tenant nav omits the unit when the hydrated label is missing", async () => {
    tenantPortalApi.getTenantWorkspace.mockResolvedValueOnce({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "raw-internal-unit-id",
        invitedEmail: "tenant@example.com",
      },
      unit: null,
    });

    render(
      <MemoryRouter>
        <TenantNav>
          <div>Tenant content</div>
        </TenantNav>
      </MemoryRouter>
    );

    expect(await screen.findByText("tenant@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/raw-internal-unit-id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unit raw-internal-unit-id/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/rental profile space|tenant-safe projections only/i)).toBeInTheDocument();
    expect(await screen.findByText(/Profile completion/i)).toBeInTheDocument();
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

  it("formats tenant rental record date-only lease dates without shifting backward", () => {
    expect(formatDate("2026-05-01")).toBe("May 1, 2026");
    expect(formatDate("2027-04-30")).toBe("Apr 30, 2027");
  });

  it("shows generated lease documents as available in the rental record", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0100",
        application: { status: "converted" },
        lease: {
          status: "active",
          monthlyRent: 1800,
          startDate: "2026-05-01",
          endDate: "2027-04-30",
          documentUrl: "https://example.com/generated-lease.pdf",
        },
      },
      identity: {
        overallStatus: "verified",
        identityVerification: {
          status: "verified",
          label: "Verified",
          note: "Verified.",
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

    expect((await screen.findAllByText(/Rental record/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.queryByText("Not shared yet")).not.toBeInTheDocument();
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

  it("tenant profile page supports phone-only save and refreshes completion guidance", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "",
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
    tenantProfileApi.updateTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "902-555-0999",
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
          available: false,
          path: null,
          label: "Open documents",
          note: null,
        },
      },
    });

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Update missing details/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Phone/i }), {
      target: { value: "902-555-0999" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save profile changes/i }));

    expect(tenantProfileApi.updateTenantProfile).toHaveBeenCalledWith({
      displayName: "Taylor Tenant",
      phone: "902-555-0999",
    });
    expect(await screen.findByText(/Profile details updated/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("902-555-0999")).toBeInTheDocument();
    expect(screen.queryByText(/Add a phone number so your profile stays current/i)).not.toBeInTheDocument();
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
    tenantProfileApi.updateTenantProfile.mockRejectedValue({
      payload: { error: "TENANT_PROFILE_FIELDS_REQUIRED" },
      message: "TENANT_PROFILE_FIELDS_REQUIRED",
    });

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("Taylor Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save profile changes/i }));
    expect(await screen.findByText(/Add at least one profile detail before saving/i)).toBeInTheDocument();
  });

  it("tenant profile completion CTA focuses the missing phone field instead of self-routing", async () => {
    tenantProfileApi.getTenantProfile.mockResolvedValue({
      context: { authority: "active_tenant" },
      profile: {
        displayName: "Taylor Tenant",
        email: "tenant@example.com",
        phone: "",
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

    render(
      <MemoryRouter>
        <TenantProfilePage />
      </MemoryRouter>
    );

    const phoneInput = await screen.findByRole("textbox", { name: /Phone/i });
    fireEvent.click(screen.getByRole("button", { name: /Update missing details/i }));

    expect(document.activeElement).toBe(phoneInput);
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

    expect(await screen.findByText(/Inbox summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Your inbox is ready when tenancy communication starts/i)).toBeInTheDocument();
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
        unreadCount: 1,
        lastMessageAt: "2026-01-06T00:00:00.000Z",
        propertyId: "prop-1",
        unitId: "unit-2",
        messages: [
          {
            id: "msg-1",
            senderRole: "landlord",
            body: "Can you confirm the move-in time?",
            createdAt: "2026-01-06T00:00:00.000Z",
            createdAtMs: 1234,
          },
        ],
      },
    });
    tenantCommunicationsApi.markTenantCommunicationsRead.mockResolvedValue(undefined);
    tenantCommunicationsApi.sendTenantCommunicationMessage.mockRejectedValue(new Error("Send failed"));

    render(
      <MemoryRouter>
        <TenantMessagesCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/A tenancy message is waiting for your reply/i)).toBeInTheDocument();
    expect(screen.getByText(/Reply needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Can you confirm the move-in time\?/i).length).toBeGreaterThan(0);
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
