import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminNotificationsPage from "./AdminNotificationsPage";

const showToast = vi.fn();

vi.mock("../../api/adminNotificationApi", () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

beforeEach(() => {
  showToast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminNotificationsPage", () => {
  it("renders notifications and navigation links", async () => {
    const { fetchNotifications } = await import("../../api/adminNotificationApi");
    vi.mocked(fetchNotifications).mockResolvedValue({
      notifications: [
        {
          version: "v1",
          id: "notification-1",
          type: "sla_escalation",
          resource: { type: "application", id: "app-1", portfolioId: "portfolio-1" },
          summary: {
            title: "Issue is overdue",
            message: "Screening reconciliation signals are inconsistent.",
          },
          severity: "critical",
          watched: true,
          state: { status: "unread", readAt: null },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:00:00.000Z",
          navigation: {
            supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1",
            triagePath: "/admin/triage?resourceType=application",
            portfolioScorePath: "/admin/portfolio-score?portfolioId=portfolio-1",
          },
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Issue is overdue/i)).toBeInTheDocument();
    expect(screen.getAllByText(/watched/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Support console/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Triage/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Portfolio score/i })).toBeInTheDocument();
  });

  it("supports unread and watched filters plus read state updates", async () => {
    const { fetchNotifications, markNotificationRead } = await import("../../api/adminNotificationApi");
    vi.mocked(fetchNotifications).mockResolvedValue({
      notifications: [
        {
          version: "v1",
          id: "notification-1",
          type: "triage_item",
          resource: { type: "application", id: "app-1" },
          summary: { title: "Critical issue needs attention", message: "Policy blocked an important action." },
          severity: "high",
          watched: false,
          state: { status: "unread", readAt: null },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:00:00.000Z",
          navigation: {},
        },
      ],
    } as any);
    vi.mocked(markNotificationRead).mockResolvedValue({ state: { status: "read" } } as any);

    render(
      <MemoryRouter>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    await screen.findByText(/Critical issue needs attention/i);

    fireEvent.click(screen.getByLabelText(/Watched only/i));
    await waitFor(() => {
      expect(vi.mocked(fetchNotifications)).toHaveBeenLastCalledWith(
        expect.objectContaining({ watchedOnly: true })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Mark read/i }));
    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith("notification-1", { read: true });
    });
  });

  it("renders empty and error states safely", async () => {
    const { fetchNotifications } = await import("../../api/adminNotificationApi");
    vi.mocked(fetchNotifications).mockResolvedValueOnce({ notifications: [] } as any);

    render(
      <MemoryRouter>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No notifications are active right now/i)).toBeInTheDocument();

    cleanup();
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new Error("Boom"));
    render(
      <MemoryRouter>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load notifications: Boom/i)).toBeInTheDocument();
  });
});
