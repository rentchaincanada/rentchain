import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UnifiedInboxPage from "./UnifiedInboxPage";
import type { UnifiedInboxRecord } from "../api/unifiedInboxApi";

const mocks = vi.hoisted(() => ({
  fetchUnifiedInbox: vi.fn(),
}));

vi.mock("../api/unifiedInboxApi", async () => {
  const actual = await vi.importActual<object>("../api/unifiedInboxApi");
  return {
    ...actual,
    fetchUnifiedInbox: mocks.fetchUnifiedInbox,
  };
});

function record(overrides: Partial<UnifiedInboxRecord>): UnifiedInboxRecord {
  return {
    id: "inbox-v1-safe",
    sourceKind: "tenant.message",
    audienceRole: "tenant",
    title: "Message update",
    body: "Your landlord replied.",
    priority: "normal",
    status: "unread",
    occurredAt: "2026-06-09T12:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

describe("UnifiedInboxPage", () => {
  beforeEach(() => {
    mocks.fetchUnifiedInbox.mockReset();
    mocks.fetchUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "tenant",
      items: [
        record({ title: "Viewing scheduled", body: "Viewing status: scheduled", sourceKind: "tenant.viewing" }),
        record({
          id: "landlord-record",
          audienceRole: "landlord",
          sourceKind: "landlord.work_order",
          title: "Landlord only",
        }),
      ],
      records: [
        record({ title: "Viewing scheduled", body: "Viewing status: scheduled", sourceKind: "tenant.viewing" }),
        record({
          id: "landlord-record",
          audienceRole: "landlord",
          sourceKind: "landlord.work_order",
          title: "Landlord only",
        }),
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the tenant unified inbox and renders only tenant-safe projected records", async () => {
    render(<UnifiedInboxPage role="tenant" />);

    expect(await screen.findByRole("heading", { name: "Tenant inbox" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchUnifiedInbox).toHaveBeenCalledWith("tenant"));
    expect(screen.getAllByText("Viewing scheduled").length).toBeGreaterThan(0);
    expect(screen.queryByText("Landlord only")).not.toBeInTheDocument();
    expect(screen.queryByText(/safe-source|safe-scope/i)).not.toBeInTheDocument();
  });

  it("renders landlord role copy and projected landlord records", async () => {
    mocks.fetchUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [
        record({
          id: "landlord-safe",
          audienceRole: "landlord",
          sourceKind: "landlord.work_order",
          title: "Work order update",
          body: "plumbing status: assigned",
        }),
      ],
      records: [
        record({
          id: "landlord-safe",
          audienceRole: "landlord",
          sourceKind: "landlord.work_order",
          title: "Work order update",
          body: "plumbing status: assigned",
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<UnifiedInboxPage role="landlord" />);

    expect(await screen.findByRole("heading", { name: "Unified inbox" })).toBeInTheDocument();
    expect(screen.getAllByText("Work order update").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Work order").length).toBeGreaterThan(0);
  });

  it("filters landlord inbox records with operational tabs, status, and search", async () => {
    mocks.fetchUnifiedInbox.mockResolvedValue({
      ok: true,
      role: "landlord",
      items: [
        record({
          id: "maintenance-priority",
          audienceRole: "landlord",
          sourceKind: "landlord.maintenance",
          title: "Pipe leak reported",
          body: "Maintenance priority at Unit 204",
          priority: "high",
          status: "unread",
        }),
        record({
          id: "lease-ready",
          audienceRole: "landlord",
          sourceKind: "landlord.lease",
          title: "Lease renewal ready",
          body: "Renewal waiting for review",
          priority: "normal",
          status: "read",
        }),
        record({
          id: "payment-balance",
          audienceRole: "landlord",
          sourceKind: "landlord.message",
          title: "Outstanding rent balance",
          body: "Payment follow-up needed",
          priority: "normal",
          status: "unread",
        }),
        record({
          id: "notice-system",
          audienceRole: "landlord",
          sourceKind: "landlord.notice",
          title: "System notice",
          body: "Notice delivery update",
          priority: "low",
          status: "read",
        }),
      ],
      records: [
        record({
          id: "maintenance-priority",
          audienceRole: "landlord",
          sourceKind: "landlord.maintenance",
          title: "Pipe leak reported",
          body: "Maintenance priority at Unit 204",
          priority: "high",
          status: "unread",
        }),
        record({
          id: "lease-ready",
          audienceRole: "landlord",
          sourceKind: "landlord.lease",
          title: "Lease renewal ready",
          body: "Renewal waiting for review",
          priority: "normal",
          status: "read",
        }),
        record({
          id: "payment-balance",
          audienceRole: "landlord",
          sourceKind: "landlord.message",
          title: "Outstanding rent balance",
          body: "Payment follow-up needed",
          priority: "normal",
          status: "unread",
        }),
        record({
          id: "notice-system",
          audienceRole: "landlord",
          sourceKind: "landlord.notice",
          title: "System notice",
          body: "Notice delivery update",
          priority: "low",
          status: "read",
        }),
      ],
      total: 4,
      limit: 20,
      offset: 0,
    });

    render(<UnifiedInboxPage role="landlord" />);

    expect(await screen.findByRole("heading", { name: "Unified inbox" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Maintenance 1/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Payments 1/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /System 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Maintenance 1/i }));
    expect(screen.getAllByText("Pipe leak reported").length).toBeGreaterThan(0);
    expect(screen.queryByText("Lease renewal ready")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pipe leak reported/i }));
    const pipeButton = screen.getByRole("button", { name: /Pipe leak reported/i });
    expect(pipeButton).toHaveAttribute("aria-expanded", "true");
    expect(pipeButton).toHaveTextContent("Read");
    expect(screen.getByRole("tab", { name: /Unread 1/i })).toBeInTheDocument();
    expect(pipeButton.nextElementSibling).toHaveTextContent("Pipe leak reported");
    expect(pipeButton.nextElementSibling).toHaveTextContent("Status");
    expect(screen.getByTestId("unified-inbox-detail-panel")).toHaveStyle({
      background: "#f8fafc",
      boxShadow: "none",
    });
    expect(screen.getByRole("link", { name: /Open work orders/i })).toHaveAttribute("href", "/work-orders");

    fireEvent.click(screen.getByRole("tab", { name: /Unread 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Outstanding rent balance/i }));
    const paymentButton = screen.getByRole("button", { name: /Outstanding rent balance/i });
    expect(paymentButton).toHaveAttribute("aria-expanded", "true");
    expect(paymentButton).toHaveTextContent("Read");
    expect(screen.getByRole("tab", { name: /Unread 0/i })).toBeInTheDocument();
    expect(screen.getByTestId("unified-inbox-detail-panel")).toHaveTextContent("Outstanding rent balance");

    fireEvent.click(screen.getByRole("tab", { name: /All 4/i }));
    fireEvent.change(screen.getByLabelText("Search inbox"), { target: { value: "balance" } });
    expect(screen.getAllByText("Outstanding rent balance").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pipe leak reported")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search inbox"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter inbox status"), { target: { value: "read" } });
    fireEvent.change(screen.getByLabelText("Filter inbox priority"), { target: { value: "low" } });
    expect(screen.getAllByText("System notice").length).toBeGreaterThan(0);
    expect(screen.queryByText("Lease renewal ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Outstanding rent balance")).not.toBeInTheDocument();
  });

  it("shows a safe error state when the inbox cannot load", async () => {
    mocks.fetchUnifiedInbox.mockRejectedValue(new Error("Unable to load inbox"));

    render(<UnifiedInboxPage role="contractor" />);

    expect(await screen.findByText("We couldn't load this inbox.")).toBeInTheDocument();
    expect(screen.getByText("Unable to load inbox")).toBeInTheDocument();
  });
});
