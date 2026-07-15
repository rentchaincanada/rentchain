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

export type LegacySchedulingDayNotesScope = {
  landlordId?: string | null;
  actorLandlordId?: string | null;
  userId?: string | null;
  id?: string | null;
  email?: string | null;
};

const LEGACY_STORAGE_PREFIX = "rentchain.schedulingDayNotes.v1";
const LEGACY_MIGRATION_STATE_PREFIX = "rentchain.schedulingDayNotesMigration.v1";

const MERIDIEM_TIME_PATTERN = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i;
const TWENTY_FOUR_HOUR_TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

function cleanLegacyScopePart(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function legacyStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function legacyScopeSuffix(scope: LegacySchedulingDayNotesScope | null | undefined): string {
  const landlord =
    cleanLegacyScopePart(scope?.actorLandlordId) || cleanLegacyScopePart(scope?.landlordId) || "landlord-unknown";
  const user =
    cleanLegacyScopePart(scope?.userId) ||
    cleanLegacyScopePart(scope?.id) ||
    cleanLegacyScopePart(scope?.email) ||
    "user-unknown";
  return `${encodeURIComponent(landlord)}:${encodeURIComponent(user)}`;
}

export function legacySchedulingDayNotesStorageKey(
  scope: LegacySchedulingDayNotesScope | null | undefined
): string {
  return `${LEGACY_STORAGE_PREFIX}:${legacyScopeSuffix(scope)}`;
}

function legacyMigrationStateStorageKey(scope: LegacySchedulingDayNotesScope | null | undefined): string {
  return `${LEGACY_MIGRATION_STATE_PREFIX}:${legacyScopeSuffix(scope)}`;
}

function normalizeLegacySchedulingDayNotes(value: unknown): SchedulingDayNotesByDate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<SchedulingDayNotesByDate>((result, [date, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(value)) return result;
    const notes = value
      .map((note, index): SchedulingDayNote | null => {
        if (!note || typeof note !== "object" || Array.isArray(note)) return null;
        const raw = note as Record<string, unknown>;
        const text = typeof raw.text === "string" ? raw.text.trim() : "";
        if (!text) return null;
        const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `note-${date}-${index}`;
        return { id, text };
      })
      .filter((note): note is SchedulingDayNote => Boolean(note));
    if (notes.length) result[date] = notes;
    return result;
  }, {});
}

export function legacySchedulingDayNoteFingerprint(date: string, note: SchedulingDayNote): string {
  return JSON.stringify([date, note.id, note.text]);
}

function readMigratedLegacySchedulingDayNoteFingerprints(
  scope: LegacySchedulingDayNotesScope | null | undefined
): Set<string> {
  if (!legacyStorageAvailable()) return new Set();
  try {
    const raw = window.localStorage.getItem(legacyMigrationStateStorageKey(scope));
    const value = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function readLegacySchedulingDayNotes(
  scope: LegacySchedulingDayNotesScope | null | undefined
): SchedulingDayNotesByDate {
  if (!legacyStorageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(legacySchedulingDayNotesStorageKey(scope));
    const notes = raw ? normalizeLegacySchedulingDayNotes(JSON.parse(raw)) : {};
    const migrated = readMigratedLegacySchedulingDayNoteFingerprints(scope);
    return Object.entries(notes).reduce<SchedulingDayNotesByDate>((result, [date, dateNotes]) => {
      const pending = dateNotes.filter((note) => !migrated.has(legacySchedulingDayNoteFingerprint(date, note)));
      if (pending.length) result[date] = pending;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function markLegacySchedulingDayNotesMigrated(
  scope: LegacySchedulingDayNotesScope | null | undefined,
  fingerprints: string[]
): void {
  if (!legacyStorageAvailable() || !fingerprints.length) return;
  const migrated = readMigratedLegacySchedulingDayNoteFingerprints(scope);
  fingerprints.forEach((fingerprint) => migrated.add(fingerprint));
  window.localStorage.setItem(legacyMigrationStateStorageKey(scope), JSON.stringify([...migrated]));
}

export function clearMigratedLegacySchedulingDayNotes(
  scope: LegacySchedulingDayNotesScope | null | undefined
): void {
  if (!legacyStorageAvailable()) return;
  window.localStorage.removeItem(legacySchedulingDayNotesStorageKey(scope));
  window.localStorage.removeItem(legacyMigrationStateStorageKey(scope));
}

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
