import { describe, expect, it } from "vitest";
import { parseSchedulingNote } from "./schedulingNoteParser";

function parse(text: string) {
  return parseSchedulingNote({ noteId: "note-1", text, date: "2026-07-22" });
}

describe("schedulingNoteParser", () => {
  it.each([
    ["9am inspection", 9 * 60, "9 AM", "inspection"],
    ["9:30 AM call plumber", 9 * 60 + 30, "9:30 AM", "call plumber"],
    ["2pm lease review", 14 * 60, "2 PM", "lease review"],
    ["14:00 contractor", 14 * 60, "2 PM", "contractor"],
    ["7 PM follow up", 19 * 60, "7 PM", "follow up"],
  ])("parses exact time in %s", (text, timeMinutes, timeLabel, cleanedTitle) => {
    expect(parse(text)).toMatchObject({
      placementType: "exact_time",
      timeMinutes,
      timeLabel,
      cleanedTitle,
      confidence: "high",
      parserMode: "deterministic",
      needsReview: false,
    });
  });

  it.each([
    ["follow up first thing", "early_morning", "Early morning"],
    ["follow up with contractor in the morning", "morning", "Morning"],
    ["call tenant after lunch", "midday", "After lunch"],
    ["review application in the afternoon", "afternoon", "Afternoon"],
    ["check messages this evening", "evening", "Evening"],
  ])("derives advisory daypart for %s", (text, daypart, timeLabel) => {
    expect(parse(text)).toMatchObject({
      placementType: "daypart",
      daypart,
      timeLabel,
      confidence: "medium",
      parserMode: "ai_suggested_ready",
    });
  });

  it.each([
    ["check Unit 3 leak before 5", 17 * 60, "Deadline cue: 5 PM"],
    ["review application by noon", 12 * 60, "Deadline cue: 12 PM"],
    ["send update before 5pm", 17 * 60, "Deadline cue: 5 PM"],
    ["send update by end of day", 17 * 60, "Deadline cue: end of day"],
    ["finish inspection before close", 17 * 60, "Deadline cue: before close"],
  ])("treats %s as a deadline rather than a confirmed appointment", (text, timeMinutes, timeLabel) => {
    expect(parse(text)).toMatchObject({ placementType: "deadline", timeMinutes, timeLabel, needsReview: true });
  });

  it.each([
    "Unit 3 leak",
    "$300 repair estimate",
    "24 hours notice",
    "7 days remaining",
    "30 day notice",
    "Call 902-555-0134",
    "Visit 123 Main Street",
    "Review lease 7842",
    "Confirm 3 tenants",
  ])(
    "does not treat %s as an exact time",
    (text) => {
      const result = parse(text);
      expect(result.placementType).toBe("unscheduled");
      expect(result).not.toHaveProperty("timeMinutes");
    }
  );

  it("keeps an ambiguous temporal note in needs review", () => {
    expect(parse("remind me to review application tomorrow")).toMatchObject({
      placementType: "unscheduled",
      confidence: "low",
      needsReview: true,
    });
  });

  it("keeps empty and cue-free notes unscheduled", () => {
    expect(parse("")).toMatchObject({ placementType: "unscheduled", needsReview: false });
    expect(parse("Call contractor")).toMatchObject({ placementType: "unscheduled", needsReview: false });
  });
});
