import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantAccountPage from "./TenantAccountPage";

const tenantApiFetchApi = vi.hoisted(() => ({
  tenantApiFetch: vi.fn(),
}));

const tenantNotificationPreferencesApi = vi.hoisted(() => ({
  getTenantNotificationPreferences: vi.fn(),
  updateTenantNotificationPreferences: vi.fn(),
}));

vi.mock("../../api/tenantApiFetch", () => tenantApiFetchApi);
vi.mock("../../api/tenantNotificationPreferences", () => tenantNotificationPreferencesApi);
vi.mock("../../lib/logoutTenant", () => ({
  logoutTenant: vi.fn(),
}));

describe("TenantAccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantApiFetchApi.tenantApiFetch.mockResolvedValue({
      ok: true,
      data: {
        tenant: {
          shortId: "tenant-1",
          email: "tenant@example.com",
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
    tenantNotificationPreferencesApi.updateTenantNotificationPreferences.mockResolvedValue({
      inApp: {
        follow_up_requested: true,
        ready_for_rereview: true,
        application_updated: true,
        access_changed: true,
        documents_updated: false,
      },
      updatedAt: 1711000000000,
    });
  });

  it("renders notification preferences with supported channels only", async () => {
    render(
      <MemoryRouter>
        <TenantAccountPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Notification preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/Supported channels:/i)).toBeInTheDocument();
    expect(screen.getByText(/In-app notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Email updates are not enabled/i)).toBeInTheDocument();
  });

  it("saves updated in-app preferences", async () => {
    render(
      <MemoryRouter>
        <TenantAccountPage />
      </MemoryRouter>
    );

    const documentsToggle = await screen.findByRole("checkbox", { name: /Documents updated/i });
    fireEvent.click(documentsToggle);
    fireEvent.click(screen.getAllByRole("button", { name: /Save preferences/i })[0]);

    await waitFor(() => {
      expect(tenantNotificationPreferencesApi.updateTenantNotificationPreferences).toHaveBeenCalledWith({
        inApp: expect.objectContaining({
          documents_updated: false,
        }),
      });
    });
    expect(await screen.findByText(/Preferences saved\./i)).toBeInTheDocument();
  });
});
