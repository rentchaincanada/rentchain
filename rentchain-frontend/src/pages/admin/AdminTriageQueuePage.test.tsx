import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminTriageQueuePage from "./AdminTriageQueuePage";

const showToast = vi.fn();

vi.mock("../../api/adminTriageApi", () => ({
  fetchAdminTriageQueue: vi.fn(),
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

describe("AdminTriageQueuePage", () => {
  it("renders queue items and support console links", async () => {
    const { fetchAdminTriageQueue } = await import("../../api/adminTriageApi");
    vi.mocked(fetchAdminTriageQueue).mockResolvedValue({
      items: [
        {
          id: "triage-1",
          version: "v1",
          category: "screening_reconciliation",
          severity: "critical",
          resource: {
            type: "application",
            id: "app-1",
            title: "Alex Applicant",
            status: "paid_not_fulfilled",
          },
          reason: {
            code: "TRIAGE_PAID_NOT_FULFILLED",
            summary: "Payment was recorded but screening completion is missing.",
          },
          signals: {
            reconciliationStatus: "paid_not_fulfilled",
            lifecycleState: "paid",
          },
          timestamps: {
            surfacedAt: "2026-04-15T12:00:00.000Z",
          },
          navigation: {
            supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1",
          },
          tags: ["screening", "revenue"],
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <AdminTriageQueuePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Alex Applicant/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment was recorded but screening completion is missing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open support console/i })).toHaveAttribute(
      "href",
      "/admin/support-console?resourceType=application&resourceId=app-1"
    );
  });

  it("updates request parameters when filters change", async () => {
    const { fetchAdminTriageQueue } = await import("../../api/adminTriageApi");
    vi.mocked(fetchAdminTriageQueue).mockResolvedValue({ items: [] } as any);

    render(
      <MemoryRouter>
        <AdminTriageQueuePage />
      </MemoryRouter>
    );

    await screen.findByText(/No triage items need attention right now/i);

    fireEvent.change(screen.getByLabelText(/Category filter/i), {
      target: { value: "policy_review" },
    });

    await waitFor(() => {
      expect(vi.mocked(fetchAdminTriageQueue)).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: "policy_review",
        })
      );
    });
  });

  it("renders empty and error states", async () => {
    const { fetchAdminTriageQueue } = await import("../../api/adminTriageApi");
    vi.mocked(fetchAdminTriageQueue).mockResolvedValueOnce({ items: [] } as any);
    vi.mocked(fetchAdminTriageQueue).mockRejectedValueOnce(new Error("Boom"));

    render(
      <MemoryRouter>
        <AdminTriageQueuePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No triage items need attention right now/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Refresh queue/i }));
    expect(await screen.findByText(/Failed to load triage queue: Boom/i)).toBeInTheDocument();
  });
});
