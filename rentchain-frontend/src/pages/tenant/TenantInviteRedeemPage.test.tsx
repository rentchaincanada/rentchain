import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantInviteRedeemPage from "./TenantInviteRedeemPage";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
  redeemTenantWorkspaceInvite: vi.fn(),
}));

vi.mock("../../api/tenantPortal", () => tenantPortalApi);

describe("TenantInviteRedeemPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("stays SSR/test-safe and does not load workspace context without a browser API base", async () => {
    render(
      <MemoryRouter>
        <TenantInviteRedeemPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/You are completing your invite/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Complete your invite/i })).toHaveAttribute("href", "/tenant/invite/redeem");
  });

  it("redeems an invite and links into application readiness", async () => {
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

    fireEvent.change(screen.getByRole("textbox", { name: /Invite token/i }), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Redeem invite/i }));

    await waitFor(() => {
      expect(tenantPortalApi.redeemTenantWorkspaceInvite).toHaveBeenCalledWith("token-123");
    });
    expect(await screen.findByText(/Invite redeemed/i)).toBeInTheDocument();
    expect(screen.getByText(/Your tenant workspace is connected/i)).toBeInTheDocument();
    expect(screen.queryByText("prop-1")).not.toBeInTheDocument();
    expect(screen.queryByText("app-1")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue to application readiness/i })).toHaveAttribute(
      "href",
      "/tenant/application?entry=invite&inviteToken=app-1"
    );
  });
});
