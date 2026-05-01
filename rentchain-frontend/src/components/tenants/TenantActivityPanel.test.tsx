import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantActivityPanel } from "./TenantActivityPanel";

const mocks = vi.hoisted(() => ({
  listTenantEvents: vi.fn(),
}));

vi.mock("../../api/tenantEvents", () => ({
  listTenantEvents: mocks.listTenantEvents,
}));

describe("TenantActivityPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.listTenantEvents.mockReset();
  });

  it("renders audited tenant notes from the landlord tenant-events feed", async () => {
    mocks.listTenantEvents.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "event-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          type: "NOTE_ADDED",
          title: "Note added",
          description: "Called tenant to confirm contact details.",
          createdAt: "2026-04-23T10:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    render(<TenantActivityPanel tenantId="tenant-1" />);

    expect(await screen.findByText("Note added")).toBeInTheDocument();
    expect(screen.getByText("Called tenant to confirm contact details.")).toBeInTheDocument();
    expect(mocks.listTenantEvents).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      limit: 25,
      cursor: undefined,
    });
  });

  it("reloads the audited activity feed when refreshed", async () => {
    mocks.listTenantEvents
      .mockResolvedValueOnce({ ok: true, items: [], nextCursor: null })
      .mockResolvedValueOnce({
        ok: true,
        items: [
          {
            id: "event-2",
            tenantId: "tenant-1",
            landlordId: "landlord-1",
            type: "NOTE_ADDED",
            title: "Note added",
            description: "Refreshed note",
            createdAt: "2026-04-23T11:00:00.000Z",
          },
        ],
        nextCursor: null,
      });

    render(<TenantActivityPanel tenantId="tenant-1" />);

    expect(await screen.findByText("No recent activity recorded for this tenant.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh" })[0]);

    await waitFor(() => expect(screen.getByText("Refreshed note")).toBeInTheDocument());
  });

  it("prefers occurredAt over createdAt when displaying the activity timestamp", async () => {
    mocks.listTenantEvents.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "event-3",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          type: "PAYMENT_RECORDED",
          title: "Payment recorded",
          description: "Manual payment entry",
          occurredAt: "2026-04-20T09:00:00.000Z",
          createdAt: "2026-04-23T11:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    render(<TenantActivityPanel tenantId="tenant-1" />);

    const expected = new Date("2026-04-20T09:00:00.000Z").toLocaleString();
    expect(await screen.findByText("Payment recorded")).toBeInTheDocument();
    expect(screen.getByText("Timeline note")).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("marks charge activity entries as timeline notes without implying ledger changes", async () => {
    mocks.listTenantEvents.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "event-4",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          type: "CHARGE_ADDED",
          title: "Charge added",
          description: "Manual charge note",
          amountCents: 12500,
          currency: "CAD",
          createdAt: "2026-04-23T11:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    render(<TenantActivityPanel tenantId="tenant-1" />);

    expect(await screen.findByText("Charge added")).toBeInTheDocument();
    expect(screen.getByText("Timeline note")).toBeInTheDocument();
    expect(screen.getByText(/CHARGE_ADDED/)).toBeInTheDocument();
  });
});
