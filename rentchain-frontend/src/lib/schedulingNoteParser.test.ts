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
    ["230pm contractor", 14 * 60 + 30, "2:30 PM", "contractor"],
    ["0230pm contractor", 14 * 60 + 30, "2:30 PM", "contractor"],
    ["1030am inspection", 10 * 60 + 30, "10:30 AM", "inspection"],
    ["630pm meeting", 18 * 60 + 30, "6:30 PM", "meeting"],
    ["0630pm meeting", 18 * 60 + 30, "6:30 PM", "meeting"],
    ["6:30pm meeting", 18 * 60 + 30, "6:30 PM", "meeting"],
    ["1230pm meeting", 12 * 60 + 30, "12:30 PM", "meeting"],
    ["1205pm meeting", 12 * 60 + 5, "12:05 PM", "meeting"],
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
    "Unit 230",
    "$230 repair estimate",
    "230 dollars",
    "230 days",
    "Unit 630",
    "$630 repair estimate",
    "630 days",
  ])(
    "does not treat %s as an exact time",
    (text) => {
      const result = parse(text);
      expect(result.placementType).toBe("unscheduled");
      expect(result).not.toHaveProperty("timeMinutes");
    }
  );

  it("places a note at its first explicit time and flags multiple time cues for review", () => {
    expect(parse("1pm painter and 4pm landscaper")).toMatchObject({
      placementType: "exact_time",
      timeMinutes: 13 * 60,
      timeLabel: "1 PM",
      needsReview: true,
      reason: "Multiple explicit time cues were detected. The first time is shown; review the original note before acting.",
    });
  });

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
