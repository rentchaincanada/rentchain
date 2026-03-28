import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewingRequestDetail } from "./ViewingRequestDetail";
import { ViewingRequestList } from "./ViewingRequestList";
import type { ViewingRequest } from "@/api/viewingsApi";

afterEach(() => {
  cleanup();
});

const scheduledRequest: ViewingRequest = {
  id: "view-1",
  landlordId: "landlord-1",
  propertyId: "property-1",
  unitId: "unit-1",
  applicationId: "app-1",
  applicantName: "Jordan Lee",
  applicantEmail: "jordan@example.com",
  applicantPhone: "5555550100",
  requestedMessage: "Weekend preferred",
  status: "scheduled",
  proposedSlots: [
    {
      id: "slot-1",
      startAt: "2026-04-05T18:00:00.000Z",
      endAt: "2026-04-05T18:30:00.000Z",
      note: "Front lobby",
      isSelected: true,
    },
  ],
  selectedSlotId: "slot-1",
  selectedSlot: {
    id: "slot-1",
    startAt: "2026-04-05T18:00:00.000Z",
    endAt: "2026-04-05T18:30:00.000Z",
    note: "Front lobby",
  },
  requestedAt: "2026-03-28T10:00:00.000Z",
  slotsProposedAt: "2026-03-28T11:00:00.000Z",
  scheduledAt: "2026-03-28T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  cancelledReason: null,
  createdAt: "2026-03-28T10:00:00.000Z",
  updatedAt: "2026-03-28T12:00:00.000Z",
  updatedByUserId: "landlord-1",
};

describe("Viewing request landlord surfaces", () => {
  it("renders at least one request correctly in the list", () => {
    const onSelect = vi.fn();
    render(<ViewingRequestList requests={[scheduledRequest]} selectedId="view-1" onSelect={onSelect} />);

    expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    expect(screen.getByText("Viewing scheduled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Jordan Lee/i }));
    expect(onSelect).toHaveBeenCalledWith("view-1");
  });

  it("renders scheduled state after a slot is selected", () => {
    render(
      <ViewingRequestDetail
        request={scheduledRequest}
        onProposeSlots={vi.fn()}
        onSelectSlot={vi.fn()}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Viewing scheduled")).toBeInTheDocument();
    expect(screen.getByText("Scheduled time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
  });
});
