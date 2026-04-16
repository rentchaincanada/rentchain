import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SupportDebugConsolePage from "./SupportDebugConsolePage";

const showToast = vi.fn();

vi.mock("../../api/supportConsoleApi", () => ({
  fetchSupportConsoleResource: vi.fn(),
}));

vi.mock("../../api/adminResolutionApi", () => ({
  createResolution: vi.fn(),
  updateResolutionStatus: vi.fn(),
  addResolutionNote: vi.fn(),
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

function renderPage(initialEntry = "/admin/support-console") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/support-console" element={<SupportDebugConsolePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SupportDebugConsolePage", () => {
  it("renders loaded support console sections", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockResolvedValue({
      resource: {
        type: "application",
        id: "app-1",
        title: "Alex Tenant",
        subtitle: "Property prop-1 • Unit unit-1",
        status: "complete",
      },
      timeline: [
        {
          id: "event-1",
          title: "Screening completed",
          description: "Screening completed for this application.",
          timestamp: "2026-04-12T10:00:00.000Z",
          domain: "screening",
          status: "completed",
          actor: "System",
        },
      ],
      insight: {
        domain: "screening",
        summary: { lifecycleState: "completed" },
      },
      policyDecisions: [
        {
          id: "policy-1",
          timestamp: "2026-04-12T09:00:00.000Z",
          action: "start_checkout",
          outcome: "allow",
          reasonCodes: ["SCREENING_READY"],
          summary: "Policy evaluated for screening.start_checkout",
        },
      ],
      automation: [
        {
          id: "automation-1",
          timestamp: "2026-04-12T09:01:00.000Z",
          action: "screening.auto_start_checkout",
          executed: true,
          skipped: false,
          summary: "Automation executed for screening.auto_start_checkout",
        },
      ],
      reconciliation: {
        status: "fulfilled",
        reasons: [{ code: "RECON_FULFILLED" }],
      },
      assignment: {
        version: "v1",
        id: "assignment-1",
        resource: { type: "application", id: "app-1" },
        currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
        createdAt: "2026-04-12T11:00:00.000Z",
        updatedAt: "2026-04-12T11:20:00.000Z",
        history: [{ id: "assign-1", timestamp: "2026-04-12T11:00:00.000Z", action: "set", toOwnerId: "admin-1", toOwnerLabel: "Morgan Ops" }],
      },
      resolution: {
        version: "v1",
        id: "resolution-1",
        resource: { type: "application", id: "app-1" },
        triage: { reasonCode: "TRIAGE_PAID_NOT_FULFILLED" },
        status: "acknowledged",
        createdAt: "2026-04-12T11:00:00.000Z",
        updatedAt: "2026-04-12T11:30:00.000Z",
        notes: [{ id: "note-1", createdAt: "2026-04-12T11:10:00.000Z", message: "Investigating." }],
        history: [{ id: "hist-1", timestamp: "2026-04-12T11:00:00.000Z", toStatus: "open" }],
      },
      debug: {
        canonicalEventCount: 4,
        domainsPresent: ["application", "screening"],
        identifiers: { propertyId: "prop-1" },
      },
    } as any);

    renderPage("/admin/support-console?resourceType=application&resourceId=app-1");

    expect(await screen.findByText(/Alex Tenant/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Derived insight/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Reconciliation$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Assignment$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Resolution$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Policy decisions/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Automation history/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Timeline$/i })).toBeInTheDocument();
    expect(screen.getByText(/Screening completed for this application/i)).toBeInTheDocument();
    expect(screen.getByText(/Assigned:\s*Morgan Ops/i)).toBeInTheDocument();
  });

  it("renders an empty state before a lookup", async () => {
    renderPage();
    expect(
      screen.getByText(/Enter a resource type and ID to inspect timeline, policy, automation, and reconciliation state/i)
    ).toBeInTheDocument();
  });

  it("renders an error state", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockRejectedValue(new Error("Boom"));

    renderPage();
    fireEvent.change(screen.getByLabelText(/Resource ID/i), { target: { value: "lease-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Inspect resource/i }));

    expect(await screen.findByText(/Failed to load support console: Boom/i)).toBeInTheDocument();
  });

  it("renders policy and automation sections when present and hides reconciliation when not applicable", async () => {
    const { fetchSupportConsoleResource } = await import("../../api/supportConsoleApi");
    vi.mocked(fetchSupportConsoleResource).mockResolvedValue({
      resource: {
        type: "maintenance",
        id: "maint-1",
        title: "Broken heater",
      },
      timeline: [],
      insight: { summary: { lifecycleState: "assigned" } },
      policyDecisions: [
        {
          id: "policy-1",
          timestamp: "2026-04-12T09:00:00.000Z",
          action: "approve_cost",
          outcome: "review",
          reasonCodes: ["MAINTENANCE_COST_REVIEW_REQUIRED"],
        },
      ],
      automation: [
        {
          id: "automation-1",
          timestamp: "2026-04-12T09:01:00.000Z",
          action: "maintenance.auto_approve_cost",
          executed: false,
          skipped: true,
          reason: "MAINTENANCE_AUTO_APPROVE_COST_POLICY_REVIEW_REQUIRED",
        },
      ],
      reconciliation: null,
      assignment: null,
      resolution: null,
      debug: {
        canonicalEventCount: 2,
        domainsPresent: ["maintenance", "policy", "system"],
        identifiers: {},
      },
    } as any);

    renderPage();
    fireEvent.change(screen.getByLabelText(/Resource type/i), { target: { value: "maintenance" } });
    fireEvent.change(screen.getByLabelText(/Resource ID/i), { target: { value: "maint-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Inspect resource/i }));

    await waitFor(() => {
      expect(screen.getByText(/Broken heater/i)).toBeInTheDocument();
      expect(screen.getByText(/^approve_cost$/i)).toBeInTheDocument();
      expect(screen.getByText(/^maintenance\.auto_approve_cost$/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Reconciliation$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No resolution record exists yet for this resource/i)).toBeInTheDocument();
  });
});
