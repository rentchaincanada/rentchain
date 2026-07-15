export type SchedulingDayNote = {
  id: string;
  text: string;
  date?: string;
  source?: "dashboard" | "scheduling" | "manual";
  createdAt?: string;
  updatedAt?: string;
};

export type SchedulingDayNotesByDate = Record<string, SchedulingDayNote[]>;

export type SchedulingNoteParsedTime = {
  hour: number;
  minute: number;
};

const MERIDIEM_TIME_PATTERN = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i;
const TWENTY_FOUR_HOUR_TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

export function dateKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseSchedulingNoteTime(text: string): SchedulingNoteParsedTime | null {
  const meridiemMatch = text.match(MERIDIEM_TIME_PATTERN);
  if (meridiemMatch) {
    const hourInput = Number(meridiemMatch[1]);
    const minute = meridiemMatch[2] ? Number(meridiemMatch[2]) : 0;
    const meridiem = meridiemMatch[3].toLowerCase();
    const hour =
      meridiem.startsWith("p") && hourInput !== 12
        ? hourInput + 12
        : meridiem.startsWith("a") && hourInput === 12
          ? 0
          : hourInput;
    return { hour, minute };
  }

  const twentyFourHourMatch = text.match(TWENTY_FOUR_HOUR_TIME_PATTERN);
  if (twentyFourHourMatch) {
    return {
      hour: Number(twentyFourHourMatch[1]),
      minute: Number(twentyFourHourMatch[2]),
    };
  }

  return null;
}
