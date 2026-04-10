import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantAccessPage from "./TenantAccessPage";

const tenantAccessApi = vi.hoisted(() => ({
  getTenantAccess: vi.fn(),
  revokeTenantAccessShare: vi.fn(),
}));

vi.mock("../../api/tenantAccess", () => tenantAccessApi);

describe("tenant access page", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders access summary, active access, and recent activity safely", async () => {
    tenantAccessApi.getTenantAccess.mockResolvedValue({
      summary: {
        activeGrants: 1,
        pendingRequests: 0,
        latestActivityAt: 1_700_000_000_000,
      },
      pendingRequests: [],
      activeAccess: [
        {
          id: "share-1",
          grantedToLabel: "Shared with your landlord for 123 Main St",
          categories: ["Rental history"],
          status: "active",
          grantedAt: 1_700_000_000_000,
          expiresAt: 1_700_100_000_000,
          lastActivityAt: 1_700_010_000_000,
          canRevoke: true,
          accessLabel: "View-only access",
        },
      ],
      recentActivity: [
        {
          id: "share-1:viewed",
          type: "access_viewed",
          title: "Your shared access link was viewed",
          occurredAt: 1_700_010_000_000,
        },
      ],
      guidance: {
        headline: "You can review and manage the access you’ve already shared.",
        body: "This view shows tenant-safe sharing records only.",
      },
    });

    render(
      <MemoryRouter>
        <TenantAccessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Access$/i)).toBeInTheDocument();
    expect(screen.getByText(/^1$/i)).toBeInTheDocument();
    expect(screen.getByText(/Active access grants/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared with your landlord for 123 Main St/i)).toBeInTheDocument();
    expect(screen.getByText(/View-only access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revoke access/i })).toBeInTheDocument();
    expect(screen.getByText(/Your shared access link was viewed/i)).toBeInTheDocument();
  });

  it("renders empty states when nothing is shared yet", async () => {
    tenantAccessApi.getTenantAccess.mockResolvedValue({
      summary: {
        activeGrants: 0,
        pendingRequests: 0,
        latestActivityAt: null,
      },
      pendingRequests: [],
      activeAccess: [],
      recentActivity: [],
      guidance: {
        headline: "Nothing is shared from your profile right now.",
        body: "This view shows tenant-safe sharing records only.",
      },
    });

    render(
      <MemoryRouter>
        <TenantAccessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Nothing is shared from your profile right now/i)).toBeInTheDocument();
    expect(screen.getByText(/No access requests right now/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing shared yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No recent access activity/i)).toBeInTheDocument();
  });

  it("revokes active access with explicit tenant action", async () => {
    tenantAccessApi.getTenantAccess
      .mockResolvedValueOnce({
        summary: {
          activeGrants: 1,
          pendingRequests: 0,
          latestActivityAt: 1_700_000_000_000,
        },
        pendingRequests: [],
        activeAccess: [
          {
            id: "share-1",
            grantedToLabel: "Shared with your landlord",
            categories: ["Rental history"],
            status: "active",
            grantedAt: 1_700_000_000_000,
            expiresAt: 1_700_100_000_000,
            lastActivityAt: null,
            canRevoke: true,
            accessLabel: "View-only access",
          },
        ],
        recentActivity: [],
        guidance: {
          headline: "You can review and manage the access you’ve already shared.",
          body: "This view shows tenant-safe sharing records only.",
        },
      })
      .mockResolvedValueOnce({
        summary: {
          activeGrants: 0,
          pendingRequests: 0,
          latestActivityAt: 1_700_020_000_000,
        },
        pendingRequests: [],
        activeAccess: [],
        recentActivity: [
          {
            id: "share-1:revoked",
            type: "access_revoked",
            title: "You revoked access",
            occurredAt: 1_700_020_000_000,
          },
        ],
        guidance: {
          headline: "Nothing is shared from your profile right now.",
          body: "This view shows tenant-safe sharing records only.",
        },
      });
    tenantAccessApi.revokeTenantAccessShare.mockResolvedValue({
      ok: true,
      shareId: "share-1",
      revoked: true,
    });

    render(
      <MemoryRouter>
        <TenantAccessPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Revoke access/i }));

    expect(tenantAccessApi.revokeTenantAccessShare).toHaveBeenCalledWith("share-1");
    expect(await screen.findByText(/Access revoked/i)).toBeInTheDocument();
    expect(screen.getByText(/You revoked access/i)).toBeInTheDocument();
  });
});
