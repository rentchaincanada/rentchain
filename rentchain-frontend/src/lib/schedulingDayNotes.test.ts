import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMigratedLegacySchedulingDayNotes,
  dateKeyFromLocalDate,
  legacySchedulingDayNoteFingerprint,
  legacySchedulingDayNotesStorageKey,
  markLegacySchedulingDayNotesMigrated,
  parseSchedulingNoteTime,
  readLegacySchedulingDayNotes,
} from "./schedulingDayNotes";

const scope = { landlordId: "Landlord 1", userId: "User@example.com" };

beforeEach(() => window.localStorage.clear());

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

  it("reads only the exact account-scoped legacy localStorage payload", () => {
    expect(legacySchedulingDayNotesStorageKey(scope)).toBe(
      "rentchain.schedulingDayNotes.v1:landlord%201:user%40example.com"
    );
    window.localStorage.setItem(
      legacySchedulingDayNotesStorageKey(scope),
      JSON.stringify({ "2026-07-14": [{ id: "legacy-1", text: "  9am inspection  " }] })
    );
    window.localStorage.setItem(
      legacySchedulingDayNotesStorageKey({ landlordId: "other", userId: "other" }),
      JSON.stringify({ "2026-07-15": [{ id: "wrong-account", text: "Do not read" }] })
    );

    expect(readLegacySchedulingDayNotes(scope)).toEqual({
      "2026-07-14": [{ id: "legacy-1", text: "9am inspection" }],
    });
  });

  it("keeps legacy storage intact while hiding completed notes from retry, then clears it after success", () => {
    const note = { id: "legacy-1", text: "9am inspection" };
    const key = legacySchedulingDayNotesStorageKey(scope);
    window.localStorage.setItem(key, JSON.stringify({ "2026-07-14": [note] }));

    markLegacySchedulingDayNotesMigrated(scope, [legacySchedulingDayNoteFingerprint("2026-07-14", note)]);

    expect(window.localStorage.getItem(key)).not.toBeNull();
    expect(readLegacySchedulingDayNotes(scope)).toEqual({});

    clearMigratedLegacySchedulingDayNotes(scope);
    expect(window.localStorage.getItem(key)).toBeNull();
  });
});
