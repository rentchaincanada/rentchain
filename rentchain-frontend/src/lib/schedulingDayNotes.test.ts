import { beforeEach, describe, expect, it } from "vitest";
import {
  dateKeyFromLocalDate,
  getSchedulingDayNotes,
  readSchedulingDayNotes,
  schedulingDayNotesStorageKey,
  writeSchedulingDayNotes,
} from "./schedulingDayNotes";

const scope = {
  landlordId: "landlord-1",
  userId: "user-1",
  email: "landlord@example.com",
};

describe("schedulingDayNotes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists browser-saved notes by account and selected date", () => {
    writeSchedulingDayNotes(scope, {
      "2026-07-15": [{ id: "note-1", text: "Confirm viewing window" }],
      "2026-07-16": [{ id: "note-2", text: "Call contractor" }],
    });

    expect(getSchedulingDayNotes(scope, "2026-07-15")).toEqual([
      { id: "note-1", text: "Confirm viewing window" },
    ]);
    expect(getSchedulingDayNotes(scope, "2026-07-16")).toEqual([
      { id: "note-2", text: "Call contractor" },
    ]);
    expect(getSchedulingDayNotes({ ...scope, userId: "user-2" }, "2026-07-15")).toEqual([]);
  });

  it("returns a safe empty state for malformed local storage", () => {
    window.localStorage.setItem(schedulingDayNotesStorageKey(scope), "{not-json");

    expect(readSchedulingDayNotes(scope)).toEqual({});
    expect(getSchedulingDayNotes(scope, "2026-07-15")).toEqual([]);
  });

  it("uses local calendar date keys", () => {
    expect(dateKeyFromLocalDate(new Date(2026, 6, 15, 23, 59))).toBe("2026-07-15");
  });
});
