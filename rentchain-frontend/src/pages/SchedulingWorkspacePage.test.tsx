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
  window.localStorage.clear();
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
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});

function renderPage(initialEntries: string[] = ["/scheduling"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SchedulingWorkspacePage />
    </MemoryRouter>
  );
}

describe("SchedulingWorkspacePage", () => {
  const legacyStorageKey = "rentchain.schedulingDayNotes.v1:landlord-1:user-1";

  it("does not show a migration notice or upload automatically when no browser-saved notes exist", () => {
    renderPage();

    expect(screen.queryByText("Browser-saved notes found")).not.toBeInTheDocument();
    expect(mocks.createSchedulingDayNoteMock).not.toHaveBeenCalled();
  });

  it("lets the landlord review browser-saved notes before explicitly moving them without overwriting workspace notes", async () => {
    window.localStorage.setItem(
      legacyStorageKey,
      JSON.stringify({ "2026-07-14": [{ id: "legacy-1", text: "9am legacy inspection" }] })
    );
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-14": [{ id: "workspace-1", text: "Existing workspace note" }],
    });
    renderPage(["/scheduling?view=day&date=2026-07-14"]);

    expect(await screen.findByText("Browser-saved notes found")).toBeInTheDocument();
    expect(mocks.createSchedulingDayNoteMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review notes" }));
    const review = screen.getByLabelText("Browser-saved notes review");
    expect(within(review).getByText("9am legacy inspection")).toBeInTheDocument();
    expect(within(review).getByText(/Existing workspace notes for this date will not be changed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move to workspace notes" }));

    await waitFor(() =>
      expect(mocks.createSchedulingDayNoteMock).toHaveBeenCalledWith("2026-07-14", {
        noteText: "9am legacy inspection",
        source: "scheduling",
      })
    );
    expect(mocks.updateSchedulingDayNoteMock).not.toHaveBeenCalled();
    await waitFor(() => expect(window.localStorage.getItem(legacyStorageKey)).toBeNull());
    expect(screen.queryByText("Browser-saved notes found")).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("9am legacy inspection")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing workspace note")).toBeInTheDocument();
  });

  it("keeps the legacy payload on failure and does not duplicate notes already created on retry", async () => {
    window.localStorage.setItem(
      legacyStorageKey,
      JSON.stringify({
        "2026-07-14": [
          { id: "legacy-1", text: "First legacy note" },
          { id: "legacy-2", text: "Second legacy note" },
        ],
      })
    );
    mocks.createSchedulingDayNoteMock
      .mockResolvedValueOnce({ id: "created-1", text: "First legacy note" })
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce({ id: "created-2", text: "Second legacy note" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Move to workspace notes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/original browser data was kept/i);
    expect(window.localStorage.getItem(legacyStorageKey)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Move to workspace notes" }));
    await waitFor(() => expect(mocks.createSchedulingDayNoteMock).toHaveBeenCalledTimes(3));
    expect(mocks.createSchedulingDayNoteMock.mock.calls.map((call) => call[1].noteText)).toEqual([
      "First legacy note",
      "Second legacy note",
      "Second legacy note",
    ]);
    await waitFor(() => expect(window.localStorage.getItem(legacyStorageKey)).toBeNull());
  });

  it("dismisses the migration notice without uploading or deleting browser-saved notes", async () => {
    window.localStorage.setItem(
      legacyStorageKey,
      JSON.stringify({ "2026-07-14": [{ id: "legacy-1", text: "Legacy note" }] })
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Browser-saved notes found")).not.toBeInTheDocument();
    expect(mocks.createSchedulingDayNoteMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(legacyStorageKey)).not.toBeNull();
  });

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
    expect(screen.queryByText("No upcoming viewing conflicts detected.")).not.toBeInTheDocument();
    expect(screen.getByText("Connected conflict detection is not enabled yet.")).toBeInTheDocument();
    expect(screen.getByText("Parser suggestions are advisory. No calendar event or reminder has been created.")).toBeInTheDocument();
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
    const confirmation = screen.getByRole("alertdialog", { name: "Delete note?" });
    expect(within(confirmation).getByText("This will remove this workspace scheduling note from the selected day.")).toBeInTheDocument();
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
    const confirmButton = within(confirmation).getByRole("button", { name: "Delete note" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mocks.deleteSchedulingDayNoteMock).toHaveBeenCalled());
    expect(within(selectedDay).getByText("1 note")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Call tenant at noon")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Confirm maintenance access")).toBeInTheDocument();
    expect(screen.getByText("Workspace note deleted.")).toBeInTheDocument();
  });

  it("cancels scheduling note deletion without calling the API", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-15": [{ id: "note-cancel", text: "Keep this note" }],
    });
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    await screen.findByDisplayValue("Keep this note");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmation = screen.getByRole("alertdialog", { name: "Delete note?" });
    await waitFor(() => expect(within(confirmation).getByRole("button", { name: "Delete note" })).toHaveFocus());

    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog", { name: "Delete note?" })).not.toBeInTheDocument();
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Keep this note")).toBeInTheDocument();
  });

  it("closes scheduling note deletion confirmation with Escape", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-15": [{ id: "note-escape", text: "Keep this note too" }],
    });
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    await screen.findByDisplayValue("Keep this note too");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.keyDown(screen.getByRole("alertdialog", { name: "Delete note?" }), { key: "Escape" });

    expect(screen.queryByRole("alertdialog", { name: "Delete note?" })).not.toBeInTheDocument();
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
  });

  it("keeps a scheduling note visible when confirmed deletion fails", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-15": [{ id: "note-failure", text: "Do not lose this note" }],
    });
    mocks.deleteSchedulingDayNoteMock.mockRejectedValueOnce(new Error("delete failed"));
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    await screen.findByDisplayValue("Do not lose this note");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmButton = screen.getByRole("button", { name: "Delete note" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Scheduling note could not be deleted. Refresh this view and try again."
    );
    expect(mocks.deleteSchedulingDayNoteMock).toHaveBeenCalledWith("2026-07-15", "note-failure");
    expect(screen.getByDisplayValue("Do not lose this note")).toBeInTheDocument();
  });

  it("routes exact-time and unscheduled mobile delete controls through confirmation", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    fireEvent(window, new Event("resize"));
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-15": [
        { id: "note-mobile-timed", text: "9am mobile inspection" },
        { id: "note-mobile-unscheduled", text: "Mobile follow-up" },
      ],
    });
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    const timedInput = await screen.findByDisplayValue("9am mobile inspection");
    const timedRow = timedInput.closest(".scheduling-note-row");
    expect(timedRow).not.toBeNull();
    fireEvent.click(within(timedRow as HTMLElement).getByRole("button", { name: "Delete" }));

    const timedConfirmation = screen.getByRole("alertdialog", { name: "Delete note?" });
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
    fireEvent.click(within(timedConfirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.getByDisplayValue("9am mobile inspection")).toBeInTheDocument();
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();

    const unscheduledInput = screen.getByDisplayValue("Mobile follow-up");
    const unscheduledRow = unscheduledInput.closest(".scheduling-note-row");
    expect(unscheduledRow).not.toBeNull();
    fireEvent.click(within(unscheduledRow as HTMLElement).getByRole("button", { name: "Delete" }));

    const unscheduledConfirmation = screen.getByRole("alertdialog", { name: "Delete note?" });
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
    const confirmButton = within(unscheduledConfirmation).getByRole("button", { name: "Delete note" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(mocks.deleteSchedulingDayNoteMock).toHaveBeenCalledWith("2026-07-15", "note-mobile-unscheduled")
    );
    expect(screen.getByDisplayValue("9am mobile inspection")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Mobile follow-up")).not.toBeInTheDocument();
  });

  it("places exact notes into slots and keeps ambiguous notes in needs review without duplication", async () => {
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
    expect(within(screen.getByLabelText("Notes needing review")).getByText("Call tenant tomorrow")).toBeInTheDocument();
    expect(within(screen.getByLabelText("7 AM-10 PM schedule")).queryByText("Call tenant tomorrow")).not.toBeInTheDocument();
  });

  it("places compact times and warns when an exact note contains multiple time cues", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-23": [
        { id: "note-compact", text: "230pm contractor" },
        { id: "note-multiple", text: "1pm painter and 4pm landscaper" },
      ],
    });
    renderPage(["/scheduling?view=day&date=2026-07-23"]);

    expect(within(await screen.findByLabelText("Schedule slot 2 PM")).getByText("230pm contractor")).toBeInTheDocument();
    const firstTimeSlot = screen.getByLabelText("Schedule slot 1 PM");
    expect(within(firstTimeSlot).getByText("1pm painter and 4pm landscaper")).toBeInTheDocument();
    expect(within(firstTimeSlot).getByText(/Needs review · Multiple explicit time cues were detected/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Schedule slot 4 PM")).queryByText("1pm painter and 4pm landscaper")).not.toBeInTheDocument();
  });

  it("flags same-time workspace notes for advisory review without creating duplicates", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-23": [
        { id: "note-same-time-1", text: "630pm meeting" },
        { id: "note-same-time-2", text: "630pm contractor follow-up" },
      ],
    });
    renderPage(["/scheduling?view=day&date=2026-07-23"]);

    const timeSlot = await screen.findByLabelText("Schedule slot 6 PM");
    expect(within(timeSlot).getByText("630pm meeting")).toBeInTheDocument();
    expect(within(timeSlot).getByText("630pm contractor follow-up")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Read-only scheduling recommendations")).getByText(
        "Multiple workspace notes share the same time. Review before confirming the schedule."
      )
    ).toBeInTheDocument();
    expect(mocks.createSchedulingDayNoteMock).not.toHaveBeenCalled();
  });

  it("shows daypart suggestions and deadline cues as advisory rather than confirmed scheduled notes", async () => {
    mocks.fetchSchedulingDayNotesRangeMock.mockResolvedValue({
      "2026-07-22": [
        { id: "note-morning", text: "Follow up with contractor in the morning" },
        { id: "note-lunch", text: "Call tenant after lunch" },
        { id: "note-deadline", text: "Check Unit 3 leak before 5" },
        { id: "note-plain", text: "Confirm access details" },
      ],
    });
    renderPage(["/scheduling?view=day&date=2026-07-22"]);

    const suggestions = await screen.findByLabelText("Suggested day plan");
    expect(within(suggestions).getByText("Follow up with contractor in the morning")).toBeInTheDocument();
    expect(within(suggestions).getByText("Call tenant after lunch")).toBeInTheDocument();
    expect(within(suggestions).getByText("Morning")).toBeInTheDocument();
    expect(within(suggestions).getByText("After lunch")).toBeInTheDocument();
    expect(screen.getByText(/AI-assisted scheduling is advisory; no calendar event has been created/i)).toBeInTheDocument();

    const review = screen.getByLabelText("Notes needing review");
    expect(within(review).getByText("Check Unit 3 leak before 5")).toBeInTheDocument();
    expect(within(review).getByText("Deadline cue: 5 PM")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Unscheduled notes")).getByText("Confirm access details")).toBeInTheDocument();
    expect(screen.getAllByText("Call tenant after lunch")).toHaveLength(1);
    expect(screen.getByDisplayValue("Call tenant after lunch")).toBeInTheDocument();
  });

  it("opens a requested day from scheduling query params", () => {
    renderPage(["/scheduling?view=day&date=2026-07-15"]);

    expect(screen.getByRole("button", { name: "Day" })).toHaveClass("is-active");
    expect(screen.getAllByText(/Wed, Jul 15/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("7 AM-10 PM schedule")).toBeInTheDocument();
  });

  it("clones scheduling content into the isolated body print root without changing schedule data", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    renderPage();

    expect(screen.getByLabelText("New schedule note")).toHaveClass("scheduling-note-draft-input");

    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    const printRoot = document.body.querySelector('[data-print-root="true"]');
    expect(printRoot).toHaveTextContent("Scheduling");
    expect(printRoot).toHaveTextContent("Notes");
    expect(printRoot).not.toHaveTextContent("Print / Save PDF");
    expect(document.body).toHaveAttribute("data-print-root-active", "true");
    expect(mocks.createSchedulingDayNoteMock).not.toHaveBeenCalled();
    expect(mocks.updateSchedulingDayNoteMock).not.toHaveBeenCalled();
    expect(mocks.deleteSchedulingDayNoteMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("afterprint"));
    expect(document.body.querySelector('[data-print-root="true"]')).not.toBeInTheDocument();
    expect(document.body).not.toHaveAttribute("data-print-root-active");
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
    expect(within(review).getAllByRole("listitem")).toHaveLength(3);
    expect(within(review).queryByRole("button")).not.toBeInTheDocument();
  });
});
