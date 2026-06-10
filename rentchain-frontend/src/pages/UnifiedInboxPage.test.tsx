import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("shows a safe error state when the inbox cannot load", async () => {
    mocks.fetchUnifiedInbox.mockRejectedValue(new Error("Unable to load inbox"));

    render(<UnifiedInboxPage role="contractor" />);

    expect(await screen.findByText("We couldn't load this inbox.")).toBeInTheDocument();
    expect(screen.getByText("Unable to load inbox")).toBeInTheDocument();
  });
});
