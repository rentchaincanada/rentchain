import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoveInReadinessPanel } from "./MoveInReadinessPanel";

describe("MoveInReadinessPanel", () => {
  const readiness = {
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    overallStatus: "in_progress" as const,
    completionPercent: 55,
    blockerCount: 1,
    nextRequiredStep: "Deposit received",
    lastUpdatedAt: "2026-03-10T10:00:00.000Z",
    items: [
      {
        key: "deposit_received" as const,
        label: "Deposit received",
        stage: "funding" as const,
        required: true,
        status: "pending" as const,
        note: "Waiting for payment confirmation",
        blockerReason: null,
        source: "system" as const,
        updatedAt: "2026-03-10T10:00:00.000Z",
        updatedByUserId: null,
      },
    ],
    events: [
      {
        id: "event-1",
        type: "item_updated" as const,
        itemKey: "deposit_received" as const,
        label: "Deposit received",
        note: "Waiting for payment confirmation",
        status: "pending" as const,
        actorRole: "system" as const,
        actorUserId: null,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ],
  };

  it("renders the readiness summary and grouped items", () => {
    render(<MoveInReadinessPanel readiness={readiness as any} onUpdate={vi.fn()} />);

    expect(screen.getByText("Move-in readiness")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getAllByText("Deposit received").length).toBeGreaterThan(0);
    expect(screen.getByText("Readiness timeline")).toBeInTheDocument();
  });
});
