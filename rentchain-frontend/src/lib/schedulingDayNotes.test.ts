import { describe, expect, it } from "vitest";
import { dateKeyFromLocalDate, parseSchedulingNoteTime } from "./schedulingDayNotes";

describe("schedulingDayNotes", () => {
  it("uses local calendar date keys", () => {
    expect(dateKeyFromLocalDate(new Date(2026, 6, 15, 23, 59))).toBe("2026-07-15");
  });

  it("parses clear note times without treating ambiguous numbers as times", () => {
    expect(parseSchedulingNoteTime("9am inspection")).toEqual({ hour: 9, minute: 0 });
    expect(parseSchedulingNoteTime("9:30 AM call plumber")).toEqual({ hour: 9, minute: 30 });
    expect(parseSchedulingNoteTime("2pm lease review")).toEqual({ hour: 14, minute: 0 });
    expect(parseSchedulingNoteTime("14:00 contractor")).toEqual({ hour: 14, minute: 0 });
    expect(parseSchedulingNoteTime("7 PM follow up")).toEqual({ hour: 19, minute: 0 });
    expect(parseSchedulingNoteTime("Unit 14 contractor follow up tomorrow")).toBeNull();
  });
});
