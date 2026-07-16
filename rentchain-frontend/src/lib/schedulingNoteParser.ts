import { parseSchedulingNoteTime } from "./schedulingDayNotes";

export type SchedulingNotePlacementType = "exact_time" | "daypart" | "deadline" | "unscheduled";
export type SchedulingNoteDaypart = "early_morning" | "morning" | "midday" | "afternoon" | "evening";
export type SchedulingNoteConfidence = "high" | "medium" | "low";
export type SchedulingNoteParserMode = "deterministic" | "ai_suggested_ready";

export type SchedulingNoteParseResult = {
  noteId: string;
  originalText: string;
  cleanedTitle: string;
  date: string;
  placementType: SchedulingNotePlacementType;
  timeMinutes?: number;
  timeLabel?: string;
  daypart?: SchedulingNoteDaypart;
  confidence: SchedulingNoteConfidence;
  reason: string;
  source: "deterministic";
  parserMode: SchedulingNoteParserMode;
  needsReview: boolean;
};

type SchedulingNoteParserInput = {
  noteId: string;
  text: string;
  date: string;
};

const EXACT_TIME_PATTERN_SOURCE = String.raw`\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:0?[1-9]|1[0-2])[0-5]\d\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b`;
const EXACT_TIME_TEXT_PATTERN = new RegExp(EXACT_TIME_PATTERN_SOURCE, "i");
const COMPACT_MERIDIEM_TIME_PATTERN = /\b(0?[1-9]|1[0-2])([0-5]\d)\s*(a\.?m\.?|p\.?m\.?)\b/i;
const DEADLINE_PATTERN = /\b(before|by)\s+(noon|midnight|(?:1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i;
const AMBIGUOUS_TEMPORAL_CUE_PATTERN = /\b(tomorrow|later|soon|after|before|by|around|sometime|tonight|today)\b/i;

const DAYPART_RULES: Array<{
  pattern: RegExp;
  daypart: SchedulingNoteDaypart;
  timeMinutes: number;
  timeLabel: string;
  reason: string;
}> = [
  {
    pattern: /\b(first thing|early morning)\b/i,
    daypart: "early_morning",
    timeMinutes: 8 * 60,
    timeLabel: "Early morning",
    reason: "The note contains an early-morning cue.",
  },
  {
    pattern: /\b(after lunch)\b/i,
    daypart: "midday",
    timeMinutes: 13 * 60,
    timeLabel: "After lunch",
    reason: "The note contains an after-lunch cue.",
  },
  {
    pattern: /\b(morning)\b/i,
    daypart: "morning",
    timeMinutes: 9 * 60,
    timeLabel: "Morning",
    reason: "The note contains a morning cue.",
  },
  {
    pattern: /\b(noon|midday)\b/i,
    daypart: "midday",
    timeMinutes: 12 * 60,
    timeLabel: "Midday",
    reason: "The note contains a midday cue.",
  },
  {
    pattern: /\b(afternoon)\b/i,
    daypart: "afternoon",
    timeMinutes: 14 * 60,
    timeLabel: "Afternoon",
    reason: "The note contains an afternoon cue.",
  },
  {
    pattern: /\b(evening|end of day)\b/i,
    daypart: "evening",
    timeMinutes: 18 * 60,
    timeLabel: "Evening",
    reason: "The note contains an evening cue.",
  },
];

function formatTimeMinutes(timeMinutes: number): string {
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour >= 12 ? "PM" : "AM"}`;
}

function cleanExactTimeTitle(text: string): string {
  return text.replace(EXACT_TIME_TEXT_PATTERN, "").replace(/^[\s,:;\-]+|[\s,:;\-]+$/g, "").replace(/\s{2,}/g, " ") || text;
}

function parseCompactMeridiemTime(text: string): { hour: number; minute: number } | null {
  const match = text.match(COMPACT_MERIDIEM_TIME_PATTERN);
  if (!match) return null;
  const hourInput = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();
  const hour =
    meridiem.startsWith("p") && hourInput !== 12
      ? hourInput + 12
      : meridiem.startsWith("a") && hourInput === 12
        ? 0
        : hourInput;
  return { hour, minute };
}

function explicitTimeCueCount(text: string): number {
  return text.match(new RegExp(EXACT_TIME_PATTERN_SOURCE, "gi"))?.length || 0;
}

function deadlineMinutes(match: RegExpMatchArray): number | null {
  const value = match[2].toLowerCase().replace(/\./g, "").trim();
  if (value === "noon") return 12 * 60;
  if (value === "midnight") return 0;
  const time = parseSchedulingNoteTime(value);
  if (time) return time.hour * 60 + time.minute;
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null;
  return (hour === 12 ? 12 : hour + 12) * 60;
}

export function parseSchedulingNote(input: SchedulingNoteParserInput): SchedulingNoteParseResult {
  const originalText = String(input.text || "").trim();
  const base = {
    noteId: input.noteId,
    originalText,
    cleanedTitle: originalText,
    date: input.date,
    source: "deterministic" as const,
  };

  if (!originalText) {
    return {
      ...base,
      placementType: "unscheduled",
      confidence: "low",
      reason: "The note is empty.",
      parserMode: "deterministic",
      needsReview: false,
    };
  }

  if (/\bend of day\b/i.test(originalText)) {
    return {
      ...base,
      placementType: "deadline",
      timeMinutes: 17 * 60,
      timeLabel: "Deadline cue: end of day",
      daypart: "afternoon",
      confidence: "medium",
      reason: "The note contains an end-of-day deadline cue, not a confirmed appointment time.",
      parserMode: "ai_suggested_ready",
      needsReview: true,
    };
  }

  if (/\bbefore close\b/i.test(originalText)) {
    return {
      ...base,
      placementType: "deadline",
      timeMinutes: 17 * 60,
      timeLabel: "Deadline cue: before close",
      daypart: "afternoon",
      confidence: "medium",
      reason: "The note contains a before-close deadline cue, not a confirmed appointment time.",
      parserMode: "ai_suggested_ready",
      needsReview: true,
    };
  }

  const deadlineMatch = originalText.match(DEADLINE_PATTERN);
  if (deadlineMatch) {
    const timeMinutes = deadlineMinutes(deadlineMatch);
    if (timeMinutes !== null) {
      return {
        ...base,
        placementType: "deadline",
        timeMinutes,
        timeLabel: `Deadline cue: ${formatTimeMinutes(timeMinutes)}`,
        daypart: timeMinutes <= 12 * 60 ? "midday" : "afternoon",
        confidence: "medium",
        reason: "The note contains a deadline cue, not a confirmed appointment time.",
        parserMode: "ai_suggested_ready",
        needsReview: true,
      };
    }
  }

  const exactTime = parseSchedulingNoteTime(originalText) || parseCompactMeridiemTime(originalText);
  if (exactTime) {
    const timeMinutes = exactTime.hour * 60 + exactTime.minute;
    const hasMultipleTimeCues = explicitTimeCueCount(originalText) > 1;
    return {
      ...base,
      cleanedTitle: cleanExactTimeTitle(originalText),
      placementType: "exact_time",
      timeMinutes,
      timeLabel: formatTimeMinutes(timeMinutes),
      confidence: "high",
      reason: hasMultipleTimeCues
        ? "Multiple explicit time cues were detected. The first time is shown; review the original note before acting."
        : "The note contains an explicit time.",
      parserMode: "deterministic",
      needsReview: hasMultipleTimeCues,
    };
  }

  const daypartRule = DAYPART_RULES.find((rule) => rule.pattern.test(originalText));
  if (daypartRule) {
    return {
      ...base,
      placementType: "daypart",
      timeMinutes: daypartRule.timeMinutes,
      timeLabel: daypartRule.timeLabel,
      daypart: daypartRule.daypart,
      confidence: "medium",
      reason: daypartRule.reason,
      parserMode: "ai_suggested_ready",
      needsReview: false,
    };
  }

  const needsReview = AMBIGUOUS_TEMPORAL_CUE_PATTERN.test(originalText);
  return {
    ...base,
    placementType: "unscheduled",
    confidence: "low",
    reason: needsReview
      ? "The note contains an ambiguous timing cue that needs review."
      : "The note does not contain a recognized time or daypart cue.",
    parserMode: needsReview ? "ai_suggested_ready" : "deterministic",
    needsReview,
  };
}
