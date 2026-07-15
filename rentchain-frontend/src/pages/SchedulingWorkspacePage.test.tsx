import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchedulingWorkspacePage from "./SchedulingWorkspacePage";
import { dateKeyFromLocalDate } from "../lib/schedulingDayNotes";

const mocks = vi.hoisted(() => ({
  fetchSchedulingDayNotesRangeMock: vi.fn(),
  createSchedulingDayNoteMock: vi.fn(),
  updateSchedulingDayNoteMock: vi.fn(),
  deleteSchedulingDayNoteMock: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "landlord@example.com",
      landlordId: "landlord-1",
    },
  }),
}));

vi.mock("../api/schedulingDayNotesApi", () => ({
  fetchSchedulingDayNotesRange: mocks.fetchSchedulingDayNotesRangeMock,
  createSchedulingDayNote: mocks.createSchedulingDayNoteMock,
  updateSchedulingDayNote: mocks.updateSchedulingDayNoteMock,
  deleteSchedulingDayNote: mocks.deleteSchedulingDayNoteMock,
}));

beforeEach(() => {
  mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({});
  mocks.createSchedulingDayNoteMock.mockImplementation(async (_date: string, payload: { noteText: string }) => ({
    id: `note-${payload.noteText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    text: payload.noteText,
  }));
  mocks.updateSchedulingDayNoteMock.mockImplementation(async (_date: string, noteId: string, payload: { noteText: string }) => ({
    id: noteId,
    text: payload.noteText,
  }));
  mocks.deleteSchedulingDayNoteMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(initialEntries: string[] = ["/scheduling"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SchedulingWorkspacePage />
    </MemoryRouter>
  );
}

describe("SchedulingWorkspacePage", () => {
  it("renders a calendar-centric scheduling workspace with operational sections", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Scheduling" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "7 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 days" })).toBeInTheDocument();
    expect(screen.getByLabelText("7 AM-10 PM schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Schedule slot 7 AM")).toBeInTheDocument();
    expect(screen.getByLabelText("Schedule slot 10 PM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Viewings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintenance Requests" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work Orders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Screening Activities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Screening Provider" })).toHaveAttribute("href", "/screening");
    expect(screen.getByRole("link", { name: "Screen Manually" })).toHaveAttribute("href", "/screening/manual");
  });

  it("switches between day, 7-day, and 30-day scheduling views", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));

    expect(screen.getByRole("button", { name: "7 days" })).toHaveClass("is-active");
    expect(screen.getByLabelText("7-day agenda summary")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "30 days" }));

    expect(screen.getByRole("button", { name: "30 days" })).toHaveClass("is-active");
    expect(screen.getByLabelText("30-day scheduling overview")).toBeInTheDocument();
  });

  it("lets landlords add, edit, and delete multiple selected-day notes", async () => {
    renderPage();

    const noteInput = screen.getByLabelText("New schedule note");
    fireEvent.change(noteInput, { target: { value: "Call tenant before viewing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByDisplayValue("Call tenant before viewing");
    fireEvent.change(noteInput, { target: { value: "Confirm maintenance access" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByDisplayValue("Confirm maintenance access");

    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    const selectedDay = screen.getByRole("button", { pressed: true });
    expect(within(selectedDay).getByText("2 notes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Call tenant before viewing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Confirm maintenance access")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Edit note 1"), { target: { value: "Call tenant at noon" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    expect(screen.getByDisplayValue("Call tenant at noon")).toBeInTheDocument();
    await waitFor(() => expect(mocks.updateSchedulingDayNoteMock).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => expect(mocks.deleteSchedulingDayNoteMock).toHaveBeenCalled());
    expect(within(selectedDay).getByText("1 note")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Call tenant at noon")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Confirm maintenance access")).toBeInTheDocument();
  });

  it("places notes with clear times into day schedule slots and keeps vague notes unscheduled", async () => {
    renderPage();

    const noteInput = screen.getByLabelText("New schedule note");
    fireEvent.change(noteInput, { target: { value: "9am inspection" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByDisplayValue("9am inspection");
    fireEvent.change(noteInput, { target: { value: "14:00 contractor" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByDisplayValue("14:00 contractor");
    fireEvent.change(noteInput, { target: { value: "Call tenant tomorrow" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByDisplayValue("Call tenant tomorrow");

    expect(within(screen.getByLabelText("Schedule slot 9 AM")).getByText("9am inspection")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Schedule slot 2 PM")).getByText("14:00 contractor")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unscheduled notes")).getByText("Call tenant tomorrow")).toBeInTheDocument();
  });

  it("opens a requested day from scheduling query params", () => {
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    expect(screen.getByRole("button", { name: "Day" })).toHaveClass("is-active");
    expect(screen.getAllByText(/Wed, Jul 15/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("7 AM-10 PM schedule")).toBeInTheDocument();
  });

  it("loads selected-day notes from backend after the scheduling page remounts", async () => {
    const todayKey = dateKeyFromLocalDate(new Date());
    mocks.fetchSchedulingDayNotesRangeMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        [todayKey]: [{ id: "note-elevator", text: "Confirm elevator booking" }],
      });
    const { unmount } = renderPage();

    const noteInput = screen.getByLabelText("New schedule note");
    fireEvent.change(noteInput, { target: { value: "Confirm elevator booking" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    expect(await screen.findByDisplayValue("Confirm elevator booking")).toBeInTheDocument();
    await waitFor(() => expect(mocks.createSchedulingDayNoteMock).toHaveBeenCalledWith(todayKey, {
      noteText: "Confirm elevator booking",
      source: "scheduling",
    }));

    unmount();
    renderPage();

    expect(await screen.findByDisplayValue("Confirm elevator booking")).toBeInTheDocument();
    expect(screen.getByText(/Notes are saved as workspace notes for this landlord account/i)).toBeInTheDocument();
  });

  it("keeps scheduling review recommendations read-only", () => {
    renderPage();

    const review = screen.getByLabelText("Read-only scheduling recommendations");
    expect(within(review).getAllByRole("listitem")).toHaveLength(4);
    expect(within(review).queryByRole("button")).not.toBeInTheDocument();
  });
});
