import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewingRequestForm } from "./ViewingRequestForm";

const { createViewingRequest } = vi.hoisted(() => ({
  createViewingRequest: vi.fn(),
}));

vi.mock("@/api/viewingsApi", async () => {
  const actual = await vi.importActual<typeof import("@/api/viewingsApi")>("@/api/viewingsApi");
  return {
    ...actual,
    createViewingRequest,
  };
});

afterEach(() => {
  cleanup();
});

describe("ViewingRequestForm", () => {
  beforeEach(() => {
    createViewingRequest.mockReset();
    createViewingRequest.mockResolvedValue({
      id: "view-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });
  });

  it("renders and submits a viewing request", async () => {
    render(<ViewingRequestForm propertyId="property-1" unitId="unit-1" />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "5555550100" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Evenings preferred" } });
    fireEvent.click(screen.getByRole("button", { name: "Request Viewing" }));

    await waitFor(() => {
      expect(createViewingRequest).toHaveBeenCalledWith({
        propertyId: "property-1",
        unitId: "unit-1",
        applicationId: null,
        applicantName: "Jordan Lee",
        applicantEmail: "jordan@example.com",
        applicantPhone: "5555550100",
        requestedMessage: "Evenings preferred",
      });
    });

    expect(
      await screen.findByText(
        "Your viewing request has been sent. The landlord or property manager will share available times."
      )
    ).toBeInTheDocument();
  });
});
