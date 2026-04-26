import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminAlertingPage from "./AdminAlertingPage";

const showToast = vi.fn();

vi.mock("../../api/adminAlertingApi", () => ({
  fetchAdminAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
}));

vi.mock("../../api/adminWatchlistApi", () => ({
  fetchWatchlist: vi.fn(),
  createWatchlistEntry: vi.fn(),
  updateWatchlistEntry: vi.fn(),
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

describe("AdminAlertingPage", () => {
  it("renders alerts and watchlist entries", async () => {
    const { fetchAdminAlerts } = await import("../../api/adminAlertingApi");
    const { fetchWatchlist } = await import("../../api/adminWatchlistApi");
    vi.mocked(fetchAdminAlerts).mockResolvedValue({
      alerts: [
        {
          version: "v1",
          id: "alert-1",
          category: "screening_reconciliation",
          severity: "critical",
          resource: { type: "application", id: "app-1", title: "Application app-1" },
          reason: { code: "ALERT_SCREENING_MISMATCH", summary: "Screening reconciliation signals are inconsistent." },
          signals: {},
          sla: { stage: "overdue", escalationLevel: "high", ageHours: 28 },
          assignment: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
          state: { isActive: true, isAcknowledged: false },
          timestamps: { createdAt: "2026-04-16T12:00:00.000Z", updatedAt: "2026-04-16T12:00:00.000Z" },
          navigation: { supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1" },
          tags: ["screening"],
        },
      ],
    } as any);
    vi.mocked(fetchWatchlist).mockResolvedValue({
      watchlist: [
        {
          version: "v1",
          id: "watch-1",
          target: { type: "application", id: "app-1" },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:00:00.000Z",
          isActive: true,
          notes: "Keep an eye on this workflow.",
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <AdminAlertingPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Screening reconciliation signals are inconsistent/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep an eye on this workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner: Morgan Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA overdue/i)).toBeInTheDocument();
  });

  it("updates filter requests and acknowledges alerts", async () => {
    const { fetchAdminAlerts, acknowledgeAlert } = await import("../../api/adminAlertingApi");
    const { fetchWatchlist } = await import("../../api/adminWatchlistApi");
    vi.mocked(fetchAdminAlerts).mockResolvedValue({
      alerts: [
        {
          version: "v1",
          id: "alert-1",
          category: "policy_exception",
          severity: "high",
          resource: { type: "lease", id: "lease-1", title: "Lease lease-1" },
          reason: { code: "ALERT_POLICY_BLOCK_REPEAT", summary: "Policy blocked an important action." },
          signals: {},
          state: { isActive: true, isAcknowledged: false },
          timestamps: { createdAt: "2026-04-16T12:00:00.000Z", updatedAt: "2026-04-16T12:00:00.000Z" },
          navigation: {},
          tags: [],
        },
      ],
    } as any);
    vi.mocked(fetchWatchlist).mockResolvedValue({ watchlist: [] } as any);
    vi.mocked(acknowledgeAlert).mockResolvedValue({ state: { acknowledged: true } } as any);

    render(
      <MemoryRouter>
        <AdminAlertingPage />
      </MemoryRouter>
    );

    await screen.findByText(/Policy blocked an important action/i);
    fireEvent.change(screen.getByLabelText(/Category filter/i), { target: { value: "policy_exception" } });

    await waitFor(() => {
      expect(vi.mocked(fetchAdminAlerts)).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "policy_exception" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/i }));
    await waitFor(() => {
      expect(acknowledgeAlert).toHaveBeenCalledWith("alert-1", { acknowledged: true });
    });
  });

  it("renders empty and error states", async () => {
    const { fetchAdminAlerts } = await import("../../api/adminAlertingApi");
    const { fetchWatchlist } = await import("../../api/adminWatchlistApi");
    vi.mocked(fetchAdminAlerts).mockResolvedValueOnce({ alerts: [] } as any);
    vi.mocked(fetchWatchlist).mockResolvedValueOnce({ watchlist: [] } as any);

    render(
      <MemoryRouter>
        <AdminAlertingPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No alerts are active right now/i)).toBeInTheDocument();

    cleanup();
    vi.mocked(fetchAdminAlerts).mockRejectedValueOnce(new Error("Boom"));
    vi.mocked(fetchWatchlist).mockResolvedValueOnce({ watchlist: [] } as any);
    render(
      <MemoryRouter>
        <AdminAlertingPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load alerts: Boom/i)).toBeInTheDocument();
  });
});
