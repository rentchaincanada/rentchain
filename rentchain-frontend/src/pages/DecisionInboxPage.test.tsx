import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DecisionInboxPage from "./DecisionInboxPage";

const apiMocks = vi.hoisted(() => ({
  fetchDecisionInbox: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/decisionInboxApi", async () => {
  const actual = await vi.importActual<any>("@/api/decisionInboxApi");
  return {
    ...actual,
    fetchDecisionInbox: apiMocks.fetchDecisionInbox,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function inboxResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "decision:review_missing_payment:lease-1",
        title: "Review Missing Payment",
        description: "Expected rent payment is missing.",
        severity: "critical",
        status: "open",
        type: "billing",
        source: "lease_ledger",
        relatedEntity: { kind: "lease", id: "lease-1", label: "Lease lease-1" },
        destination: "/leases/lease-1/ledger",
        automationEligible: false,
        createdAt: "2026-05-05T12:00:00.000Z",
        updatedAt: "2026-05-05T12:00:00.000Z",
      },
      {
        id: "approve_maintenance_cost:wo-1",
        title: "Open cost approval",
        description: "A maintenance cost needs review.",
        severity: "high",
        status: "blocked",
        type: "maintenance",
        source: "analytics",
        relatedEntity: { kind: "maintenance_request", id: "wo-1", label: "Work order wo-1" },
        destination: null,
        automationEligible: false,
        createdAt: null,
        updatedAt: null,
      },
    ],
    filters: {
      severity: ["critical", "high"],
      status: ["open", "blocked"],
      type: ["billing", "maintenance"],
    },
    summary: {
      total: 2,
      critical: 1,
      high: 1,
      open: 1,
      blocked: 1,
    },
    ...overrides,
  };
}

describe("DecisionInboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchDecisionInbox.mockResolvedValue(inboxResponse());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders summary counts, badges, and safe context links", async () => {
    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Decision inbox" })).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getByText("Review Missing Payment")).toBeInTheDocument();
    expect(screen.getByText("Expected rent payment is missing.")).toBeInTheDocument();
    expect(screen.getByText("Source: Lease Ledger")).toBeInTheDocument();
    expect(screen.getByText("Related: Lease lease-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByText("Open cost approval")).toBeInTheDocument();
    expect(screen.getByText("No context link available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve|dismiss|snooze|approve|retry|execute/i })).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("updates visible decisions through deterministic filters", async () => {
    apiMocks.fetchDecisionInbox
      .mockResolvedValueOnce(inboxResponse())
      .mockResolvedValueOnce(
        inboxResponse({
          items: [inboxResponse().items[0]],
          summary: { total: 1, critical: 1, high: 0, open: 1, blocked: 0 },
        })
      );

    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Review Missing Payment")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "critical" } });

    await waitFor(() => {
      expect(apiMocks.fetchDecisionInbox).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: "critical", status: "all", type: "all" })
      );
    });
  });

  it("renders an empty state when no decisions match filters", async () => {
    apiMocks.fetchDecisionInbox.mockResolvedValue(
      inboxResponse({
        items: [],
        summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
      })
    );

    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No decisions match the current filters.")).toBeInTheDocument();
  });
});
