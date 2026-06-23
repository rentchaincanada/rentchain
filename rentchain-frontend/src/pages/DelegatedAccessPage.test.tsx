import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DelegatedAccessPage from "./DelegatedAccessPage";
import type { DelegatedAccessGrant, DelegatedAccessInvitation } from "../api/delegatedAccessApi";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  showToast: vi.fn(),
  fetchDelegates: vi.fn(),
  fetchGrants: vi.fn(),
  fetchInvitations: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  revokeGrant: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../api/delegatedAccessApi", async () => {
  const actual = await vi.importActual<object>("../api/delegatedAccessApi");
  return {
    ...actual,
    fetchDelegatedAccessDelegates: mocks.fetchDelegates,
    fetchDelegatedAccessGrants: mocks.fetchGrants,
    fetchDelegatedAccessInvitations: mocks.fetchInvitations,
    createDelegatedAccessInvitation: mocks.createInvitation,
    cancelDelegatedAccessInvitation: mocks.cancelInvitation,
    revokeDelegatedAccessGrant: mocks.revokeGrant,
  };
});

function grant(overrides: Partial<DelegatedAccessGrant> = {}): DelegatedAccessGrant {
  return {
    grantId: "grant-internal-1",
    delegateUserId: "delegate-user-1",
    delegateEmail: "manager@example.com",
    role: "property_manager",
    status: "active",
    permissionScope: {
      role: "property_manager",
      workspaceScopes: ["dashboard", "operations"],
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      resourceScope: {},
      permissionFlags: ["view", "edit"],
      billingAccess: false,
      exportAccess: false,
    },
    createdAt: "2026-06-22T12:00:00.000Z",
    acceptedAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z",
    revokedAt: null,
    revocationReason: null,
    ...overrides,
  };
}

function invitation(overrides: Partial<DelegatedAccessInvitation> = {}): DelegatedAccessInvitation {
  return {
    invitationId: "invitation-internal-1",
    inviteeEmail: "assistant@example.com",
    role: "assistant_office_admin",
    propertyScope: { mode: "all_current_properties", propertyIds: [] },
    workspaceScopes: ["dashboard", "unified_inbox"],
    resourceScope: {},
    permissionFlags: ["view", "message"],
    status: "pending",
    expiresAt: "2026-07-22T23:59:59.000Z",
    createdAt: "2026-06-22T12:00:00.000Z",
    acceptedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe("DelegatedAccessPage", () => {
  beforeEach(() => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "owner-user-1", role: "landlord", email: "owner@example.com" },
    });
    mocks.fetchDelegates.mockResolvedValue([
      {
        delegateUserId: "delegate-user-1",
        delegateEmail: "manager@example.com",
        roles: ["property_manager"],
        activeGrantCount: 1,
        revokedGrantCount: 0,
        workspaceScopes: ["dashboard", "operations"],
        propertyScopeSummary: "all_current_properties",
        lastActiveAt: "2026-06-22T12:00:00.000Z",
      },
    ]);
    mocks.fetchGrants.mockResolvedValue([grant()]);
    mocks.fetchInvitations.mockResolvedValue([invitation()]);
    mocks.createInvitation.mockResolvedValue({
      ok: true,
      invitation: invitation({ inviteeEmail: "new@example.com", emailDispatch: { status: "sent" } }),
      emailDispatch: { status: "sent" },
    });
    mocks.cancelInvitation.mockResolvedValue({
      ok: true,
      invitation: invitation({ status: "cancelled", cancelledAt: "2026-06-23T12:00:00.000Z" }),
    });
    mocks.revokeGrant.mockResolvedValue({ ok: true, grant: grant({ status: "revoked" }) });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists delegates, pending invitations, and active grants without showing internal ids or token data", async () => {
    const { container } = render(<DelegatedAccessPage />);

    expect(await screen.findByRole("heading", { name: "Delegate Management" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ margin: "0 auto", maxWidth: "1320px" });
    expect(screen.getByText("Never share your login. Invite delegates to their own account.")).toBeInTheDocument();
    expect(screen.getByText("assistant@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("manager@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Property Manager")).toBeInTheDocument();
    expect(screen.getByText("Assistant / Office Admin · All current properties")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.queryByText(/grant-internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invitation-internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tokenHash|valid-token/i)).not.toBeInTheDocument();
  });

  it("creates a pending invitation with role, scope, and permission fields", async () => {
    render(<DelegatedAccessPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Invite Delegate" }));
    expect(screen.queryByRole("combobox", { name: "Property scope" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Property scope")).toHaveTextContent("All current properties");
    fireEvent.change(screen.getByLabelText("Delegate email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Delegate role"), { target: { value: "maintenance_coordinator" } });
    fireEvent.click(screen.getByLabelText("Properties"));
    fireEvent.click(screen.getByLabelText("Assign"));
    fireEvent.click(screen.getByRole("button", { name: "Create Invitation" }));

    await waitFor(() => expect(mocks.createInvitation).toHaveBeenCalledTimes(1));
    expect(mocks.createInvitation.mock.calls[0][0]).toMatchObject({
      inviteeEmail: "new@example.com",
      role: "maintenance_coordinator",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: expect.arrayContaining(["dashboard", "operations", "properties"]),
      permissionFlags: expect.arrayContaining(["view", "assign"]),
    });
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Delegate invitation created",
        description: expect.stringMatching(/Invitation email was sent/i),
      })
    );
  });

  it("warns when the invitation is saved but email dispatch fails", async () => {
    mocks.createInvitation.mockResolvedValueOnce({
      ok: true,
      invitation: invitation({ inviteeEmail: "new@example.com", emailDispatch: { status: "failed" } }),
      emailDispatch: { status: "failed" },
    });
    render(<DelegatedAccessPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Invite Delegate" }));
    fireEvent.change(screen.getByLabelText("Delegate email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Invitation" }));

    await waitFor(() => expect(mocks.createInvitation).toHaveBeenCalledTimes(1));
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Delegate invitation created",
        description: expect.stringMatching(/email delivery failed/i),
        variant: "warning",
      })
    );
  });

  it("cancels pending invitations and removes the cancel action after cancellation", async () => {
    render(<DelegatedAccessPage />);

    expect(await screen.findByText("assistant@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Invitation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel Invitation" }));

    await waitFor(() => expect(mocks.cancelInvitation).toHaveBeenCalledWith("invitation-internal-1"));
    const visibleRecords = screen.getAllByTestId("delegated-access-record");
    const invitationRecord = visibleRecords.find((record) => record.textContent?.includes("assistant@example.com"));
    expect(invitationRecord).toBeTruthy();
    expect(invitationRecord).toHaveAttribute("data-status", "cancelled");
    expect(invitationRecord).toHaveTextContent("Cancelled");
    expect(screen.queryByRole("button", { name: "Cancel Invitation" })).not.toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invitation cancelled",
      })
    );
  });

  it("does not offer cancel for cancelled or expired invitations", async () => {
    mocks.fetchInvitations.mockResolvedValue([
      invitation({ invitationId: "cancelled-invitation", inviteeEmail: "cancelled@example.com", status: "cancelled" }),
      invitation({ invitationId: "expired-invitation", inviteeEmail: "expired@example.com", status: "expired" }),
    ]);

    render(<DelegatedAccessPage />);

    expect(await screen.findByText("cancelled@example.com")).toBeInTheDocument();
    expect(screen.getByText("expired@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Invitation" })).not.toBeInTheDocument();
  });

  it("revokes an active grant and leaves revoked grants as non-repeatable records", async () => {
    mocks.fetchGrants.mockResolvedValue([
      grant(),
      grant({
        grantId: "grant-internal-2",
        delegateEmail: "former@example.com",
        status: "revoked",
        revokedAt: "2026-06-23T12:00:00.000Z",
        revocationReason: "Staff turnover",
      }),
    ]);
    render(<DelegatedAccessPage />);

    await screen.findByText("former@example.com");
    expect(screen.getAllByRole("button", { name: "Revoke Access" })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Revocation reason for manager@example.com"), {
      target: { value: "Staff turnover" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revoke Access" }));

    await waitFor(() => expect(mocks.revokeGrant).toHaveBeenCalledWith("grant-internal-1", "Staff turnover"));
    expect(screen.getByText("Reason: Staff turnover")).toBeInTheDocument();
  });

  it("shows a calm empty state when there are no delegates, grants, or invitations", async () => {
    mocks.fetchDelegates.mockResolvedValue([]);
    mocks.fetchGrants.mockResolvedValue([]);
    mocks.fetchInvitations.mockResolvedValue([]);

    render(<DelegatedAccessPage />);

    expect(await screen.findByText("No delegated access yet")).toBeInTheDocument();
    expect(screen.getByText(/Invite delegates when you need staff or external collaborators/i)).toBeInTheDocument();
  });

  it("blocks non-owner users before loading delegate data", async () => {
    mocks.useAuthMock.mockReturnValue({
      user: { id: "delegate-user-1", role: "delegate", email: "delegate@example.com" },
    });
    mocks.fetchDelegates.mockResolvedValue([
      {
        delegateUserId: "delegate-user-1",
        delegateEmail: "manager@example.com",
        roles: ["property_manager"],
        activeGrantCount: 1,
        revokedGrantCount: 0,
        workspaceScopes: ["dashboard"],
        propertyScopeSummary: "all_current_properties",
        lastActiveAt: "2026-06-22T12:00:00.000Z",
      },
    ]);
    mocks.fetchGrants.mockResolvedValue([grant()]);
    mocks.fetchInvitations.mockResolvedValue([invitation()]);

    render(<DelegatedAccessPage />);

    expect(screen.getByText("Delegate management is available only to landlord owners.")).toBeInTheDocument();
    expect(mocks.fetchDelegates).not.toHaveBeenCalled();
    expect(mocks.fetchGrants).not.toHaveBeenCalled();
    expect(mocks.fetchInvitations).not.toHaveBeenCalled();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
    expect(mocks.revokeGrant).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Invite Delegate" })).not.toBeInTheDocument();
    expect(screen.queryByText("manager@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("assistant@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Property Manager")).not.toBeInTheDocument();
  });

  it("filters visible records by status", async () => {
    mocks.fetchGrants.mockResolvedValue([grant(), grant({ grantId: "revoked-grant", delegateEmail: "former@example.com", status: "revoked" })]);
    mocks.fetchInvitations.mockResolvedValue([
      invitation(),
      invitation({ invitationId: "expired-invitation", inviteeEmail: "expired@example.com", status: "expired" }),
    ]);

    render(<DelegatedAccessPage />);

    expect(await screen.findByText("assistant@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoked" }));

    const visibleRecords = screen.getAllByTestId("delegated-access-record");
    expect(visibleRecords).toHaveLength(1);
    expect(visibleRecords[0]).toHaveAttribute("data-status", "revoked");
    expect(visibleRecords[0]).toHaveTextContent("former@example.com");
    expect(visibleRecords[0]).not.toHaveTextContent("assistant@example.com");
    expect(visibleRecords[0]).not.toHaveTextContent("manager@example.com");
  });
});
