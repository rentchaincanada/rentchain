import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminLeaseLifecycleReviewPage from "./AdminLeaseLifecycleReviewPage";

vi.mock("../../api/adminLeaseLifecycleReviewApi", () => ({
  fetchAdminLeaseLifecycleReviewQueue: vi.fn(),
  updateAdminLeaseLifecycleReviewAcknowledgement: vi.fn(),
}));

vi.mock("@/api/decisionApi", () => ({
  patchDecisionAction: vi.fn(),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AdminLeaseLifecycleReviewPage", () => {
  it("renders summary counts and read-only review items", async () => {
    const { fetchAdminLeaseLifecycleReviewQueue } = await import("../../api/adminLeaseLifecycleReviewApi");
    vi.mocked(fetchAdminLeaseLifecycleReviewQueue).mockResolvedValue({
      ok: true,
      summary: {
        total: 2,
        critical: 1,
        warning: 1,
        info: 0,
      },
      items: [
        {
          id: "lease_lifecycle:lease-1:unknown_lifecycle",
          leaseId: "lease-1",
          propertyId: "property-1",
          unitId: "unit-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          derivedLifecycleState: "unknown",
          derivedLifecycleReasons: ["date_range_invalid"],
          severity: "critical",
          category: "unknown_lifecycle",
          title: "Lease lifecycle needs review",
          description: "Canonical lifecycle derivation could not safely classify this lease.",
          recommendedAction: "Open lease record",
          createdFrom: "lease_lifecycle_review_queue_v1",
          detectedAt: "2026-05-05T12:00:00.000Z",
          acknowledgement: {
            acknowledgementId: "ack-1",
            reviewItemId: "lease_lifecycle:lease-1:unknown_lifecycle",
            leaseId: "lease-1",
            landlordId: "landlord-1",
            propertyId: "property-1",
            unitId: "unit-1",
            status: "reviewed",
            acknowledgedBy: "admin-1",
            acknowledgedAt: "2026-05-05T12:00:00.000Z",
            updatedAt: "2026-05-05T12:00:00.000Z",
          },
          recentHistory: [
            {
              historyId: "history-1",
              reviewItemId: "lease_lifecycle:lease-1:unknown_lifecycle",
              leaseId: "lease-1",
              landlordId: "landlord-1",
              propertyId: "property-1",
              unitId: "unit-1",
              action: "reviewed",
              previousStatus: null,
              nextStatus: "reviewed",
              note: "Reviewed by ops",
              actorId: "admin-1",
              actorEmail: "admin@example.com",
              createdAt: "2026-05-05T12:00:00.000Z",
            },
          ],
        },
        {
          id: "lease_lifecycle:lease-2:expired_occupancy_conflict",
          leaseId: "lease-2",
          propertyId: "property-2",
          unitId: "unit-2",
          landlordId: "landlord-2",
          derivedLifecycleState: "expired",
          derivedLifecycleReasons: ["end_date_past"],
          severity: "warning",
          category: "expired_occupancy_conflict",
          title: "Expired lease conflicts with manual occupancy",
          description: "The lease is expired, but the unit has current manual occupied data.",
          recommendedAction: "Confirm occupancy manually",
          createdFrom: "lease_lifecycle_review_queue_v1",
          detectedAt: "2026-05-05T12:00:00.000Z",
          acknowledgement: null,
          recentHistory: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminLeaseLifecycleReviewPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Lease lifecycle needs review/i)).toBeInTheDocument();
    expect(screen.getByText(/Expired lease conflicts with manual occupancy/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown lifecycle/i)).toBeInTheDocument();
    expect(screen.getByText(/expired occupancy conflict/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Open lease record/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirm occupancy manually/i)).toBeInTheDocument();
    expect(screen.getAllByText(/reviewed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Mark reviewed/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Snooze/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Assign/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recent history/i).length).toBe(2);
    expect(screen.getByText(/Reviewed by ops/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/No history yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Related decision/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Lease summary" }).some((link) => link.getAttribute("href") === "/leases/lease-2/summary")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Lease ledger" }).some((link) => link.getAttribute("href") === "/leases/lease-2/ledger")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Property / unit" }).some((link) => link.getAttribute("href") === "/properties?propertyId=property-2&unitId=unit-2")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Lifecycle review" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Occupancy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lease lifecycle indicates an occupancy conflict that needs review/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: "Open lease record" })
        .some((link) => link.getAttribute("href") === "/admin/leases?q=lease-1")
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /fix/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Fix automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });

  it("updates related decision lifecycle state from row actions", async () => {
    const { fetchAdminLeaseLifecycleReviewQueue } = await import("../../api/adminLeaseLifecycleReviewApi");
    const { patchDecisionAction } = await import("@/api/decisionApi");
    vi.mocked(fetchAdminLeaseLifecycleReviewQueue).mockResolvedValue({
      ok: true,
      summary: { total: 1, critical: 0, warning: 1, info: 0 },
      items: [
        {
          id: "lease_lifecycle:lease-2:expired_occupancy_conflict",
          leaseId: "lease-2",
          propertyId: "property-2",
          unitId: "unit-2",
          landlordId: "landlord-2",
          derivedLifecycleState: "expired",
          derivedLifecycleReasons: ["end_date_past"],
          severity: "warning",
          category: "expired_occupancy_conflict",
          title: "Expired lease conflicts with manual occupancy",
          description: "The lease is expired, but the unit has current manual occupied data.",
          recommendedAction: "Confirm occupancy manually",
          createdFrom: "lease_lifecycle_review_queue_v1",
          detectedAt: "2026-05-05T12:00:00.000Z",
          acknowledgement: null,
          recentHistory: [],
        },
      ],
    });
    vi.mocked(patchDecisionAction).mockResolvedValue({
      ok: true,
      decision: {
        decisionId: "decision:review_occupancy_conflict:lease_lifecycle:lease-2:expired_occupancy_conflict",
        leaseId: "lease-2",
        propertyId: "property-2",
        unitId: "unit-2",
        decisionType: "review_occupancy_conflict",
        severity: "warning",
        status: "resolved",
        reason: "Lease lifecycle indicates an occupancy conflict that needs review.",
        metadata: {},
      },
    });

    render(
      <MemoryRouter>
        <AdminLeaseLifecycleReviewPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Related decision/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    expect(vi.mocked(patchDecisionAction)).toHaveBeenCalledWith(
      expect.stringContaining("review_occupancy_conflict"),
      expect.objectContaining({ actionType: "resolved", leaseId: "lease-2" })
    );
    await screen.findAllByText("Resolved");
    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
  });

  it("updates acknowledgement state from row actions", async () => {
    const { fetchAdminLeaseLifecycleReviewQueue, updateAdminLeaseLifecycleReviewAcknowledgement } = await import(
      "../../api/adminLeaseLifecycleReviewApi"
    );
    vi.mocked(fetchAdminLeaseLifecycleReviewQueue).mockResolvedValue({
      ok: true,
      summary: {
        total: 1,
        critical: 1,
        warning: 0,
        info: 0,
      },
      items: [
        {
          id: "lease_lifecycle:lease-1:unknown_lifecycle",
          leaseId: "lease-1",
          propertyId: "property-1",
          unitId: "unit-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          derivedLifecycleState: "unknown",
          derivedLifecycleReasons: ["date_range_invalid"],
          severity: "critical",
          category: "unknown_lifecycle",
          title: "Lease lifecycle needs review",
          description: "Canonical lifecycle derivation could not safely classify this lease.",
          recommendedAction: "Open lease record",
          createdFrom: "lease_lifecycle_review_queue_v1",
          detectedAt: "2026-05-05T12:00:00.000Z",
          acknowledgement: null,
          recentHistory: [],
        },
      ],
    });
    vi.mocked(updateAdminLeaseLifecycleReviewAcknowledgement).mockResolvedValue({
      ok: true,
      acknowledgement: {
        acknowledgementId: "ack-1",
        reviewItemId: "lease_lifecycle:lease-1:unknown_lifecycle",
        leaseId: "lease-1",
        landlordId: "landlord-1",
        propertyId: "property-1",
        unitId: "unit-1",
        status: "reviewed",
        acknowledgedBy: "admin-1",
        acknowledgedAt: "2026-05-05T12:00:00.000Z",
        updatedAt: "2026-05-05T12:00:00.000Z",
      },
      historyEvent: {
        historyId: "history-1",
        reviewItemId: "lease_lifecycle:lease-1:unknown_lifecycle",
        leaseId: "lease-1",
        landlordId: "landlord-1",
        propertyId: "property-1",
        unitId: "unit-1",
        action: "reviewed",
        previousStatus: null,
        nextStatus: "reviewed",
        note: "Reviewed from lease lifecycle queue",
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        createdAt: "2026-05-05T12:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AdminLeaseLifecycleReviewPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Mark reviewed/i }));

    expect(vi.mocked(updateAdminLeaseLifecycleReviewAcknowledgement)).toHaveBeenCalledWith(
      "lease_lifecycle:lease-1:unknown_lifecycle",
      expect.objectContaining({
        status: "reviewed",
      })
    );
    expect((await screen.findAllByText(/reviewed/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Reviewed from lease lifecycle queue/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/i)).toBeInTheDocument();
  });

  it("renders empty and error states", async () => {
    const { fetchAdminLeaseLifecycleReviewQueue } = await import("../../api/adminLeaseLifecycleReviewApi");
    vi.mocked(fetchAdminLeaseLifecycleReviewQueue)
      .mockResolvedValueOnce({
        ok: true,
        summary: { total: 0, critical: 0, warning: 0, info: 0 },
        items: [],
      })
      .mockRejectedValueOnce(new Error("Boom"));

    render(
      <MemoryRouter>
        <AdminLeaseLifecycleReviewPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No lease lifecycle review items need attention right now/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(await screen.findByText(/Failed to load lease lifecycle review queue: Boom/i)).toBeInTheDocument();
  });
});
