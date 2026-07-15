export type SchedulingDayNote = {
  id: string;
  text: string;
};

export type SchedulingDayNotesByDate = Record<string, SchedulingDayNote[]>;

export type SchedulingDayNotesScope = {
  landlordId?: string | null;
  actorLandlordId?: string | null;
  userId?: string | null;
  id?: string | null;
  email?: string | null;
};

const STORAGE_PREFIX = "rentchain.schedulingDayNotes.v1";

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
