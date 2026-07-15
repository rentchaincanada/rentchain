export type SchedulingDayNote = {
  id: string;
  text: string;
};

export type SchedulingDayNotesByDate = Record<string, SchedulingDayNote[]>;

export type SchedulingNoteParsedTime = {
  hour: number;
  minute: number;
};

export type SchedulingDayNotesScope = {
  landlordId?: string | null;
  actorLandlordId?: string | null;
  userId?: string | null;
  id?: string | null;
  email?: string | null;
};

const STORAGE_PREFIX = "rentchain.schedulingDayNotes.v1";
const MERIDIEM_TIME_PATTERN = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i;
const TWENTY_FOUR_HOUR_TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

function cleanPart(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function dateKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function schedulingDayNotesStorageKey(scope: SchedulingDayNotesScope | null | undefined): string {
  const landlord = cleanPart(scope?.actorLandlordId) || cleanPart(scope?.landlordId) || "landlord-unknown";
  const user = cleanPart(scope?.userId) || cleanPart(scope?.id) || cleanPart(scope?.email) || "user-unknown";
  return `${STORAGE_PREFIX}:${encodeURIComponent(landlord)}:${encodeURIComponent(user)}`;
}

function normalizeNotesByDate(value: unknown): SchedulingDayNotesByDate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<SchedulingDayNotesByDate>((result, [dateKey, rawNotes]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Array.isArray(rawNotes)) {
      return result;
    }

    const notes = rawNotes
      .map((note, index): SchedulingDayNote | null => {
        if (!note || typeof note !== "object" || Array.isArray(note)) {
          return null;
        }
        const raw = note as Record<string, unknown>;
        const text = typeof raw.text === "string" ? raw.text.trim() : "";
        if (!text) {
          return null;
        }
        const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `note-${dateKey}-${index}`;
        return { id, text };
      })
      .filter((note): note is SchedulingDayNote => Boolean(note));

    if (notes.length) {
      result[dateKey] = notes;
    }

    return result;
  }, {});
}

export function readSchedulingDayNotes(scope: SchedulingDayNotesScope | null | undefined): SchedulingDayNotesByDate {
  if (!storageAvailable()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(schedulingDayNotesStorageKey(scope));
    return raw ? normalizeNotesByDate(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function writeSchedulingDayNotes(
  scope: SchedulingDayNotesScope | null | undefined,
  notesByDate: SchedulingDayNotesByDate
): void {
  if (!storageAvailable()) {
    return;
  }

  try {
    const normalized = normalizeNotesByDate(notesByDate);
    window.localStorage.setItem(schedulingDayNotesStorageKey(scope), JSON.stringify(normalized));
  } catch {
    // Local browser storage is best-effort; scheduling note edits remain visible in page state.
  }
}

export function getSchedulingDayNotes(
  scope: SchedulingDayNotesScope | null | undefined,
  dateKey: string
): SchedulingDayNote[] {
  return readSchedulingDayNotes(scope)[dateKey] || [];
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
