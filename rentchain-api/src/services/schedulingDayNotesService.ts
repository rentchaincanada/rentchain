import { randomUUID } from "crypto";
import { db } from "../firebase";

export const SCHEDULING_DAY_NOTES_COLLECTION = "schedulingDayNotes";

export type SchedulingDayNoteStatus = "active" | "deleted";
export type SchedulingDayNoteSource = "dashboard" | "scheduling" | "manual";

export type SchedulingDayNoteActor = {
  id: string;
  email?: string | null;
};

export type SchedulingDayNoteRecord = {
  noteId: string;
  landlordId: string;
  date: string;
  noteText: string;
  source: SchedulingDayNoteSource;
  status: SchedulingDayNoteStatus;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string | null;
  updatedAt: string;
  updatedBy: string;
  updatedByEmail?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByEmail?: string | null;
};

export type SchedulingDayNotesByDate = Record<string, SchedulingDayNoteRecord[]>;

export class SchedulingDayNotesValidationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_TEXT_LENGTH = 2000;
const MAX_RANGE_DAYS = 62;

function nowIso(): string {
  return new Date().toISOString();
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function parseDateKey(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export function assertSchedulingDate(value: unknown, fieldName = "date"): string {
  const date = cleanString(value, 32);
  if (!parseDateKey(date)) {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_INVALID_DATE", `${fieldName} must be YYYY-MM-DD`);
  }
  return date;
}

export function assertSchedulingDateRange(startDateValue: unknown, endDateValue: unknown) {
  const startDate = assertSchedulingDate(startDateValue, "startDate");
  const endDate = assertSchedulingDate(endDateValue, "endDate");
  const start = parseDateKey(startDate)!;
  const end = parseDateKey(endDate)!;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) {
    throw new SchedulingDayNotesValidationError(
      "SCHEDULING_DAY_NOTE_INVALID_DATE_RANGE",
      "endDate must be on or after startDate"
    );
  }
  if (days > MAX_RANGE_DAYS) {
    throw new SchedulingDayNotesValidationError(
      "SCHEDULING_DAY_NOTE_DATE_RANGE_TOO_LARGE",
      `Date range must be ${MAX_RANGE_DAYS} days or less`
    );
  }
  return { startDate, endDate };
}

export function normalizeSchedulingDayNoteText(value: unknown): string {
  const text = cleanString(value, MAX_NOTE_TEXT_LENGTH + 1);
  if (!text) {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_TEXT_REQUIRED", "noteText is required");
  }
  if (text.length > MAX_NOTE_TEXT_LENGTH) {
    throw new SchedulingDayNotesValidationError(
      "SCHEDULING_DAY_NOTE_TEXT_TOO_LONG",
      `noteText must be ${MAX_NOTE_TEXT_LENGTH} characters or less`
    );
  }
  return text;
}

export function normalizeSchedulingDayNoteSource(value: unknown): SchedulingDayNoteSource {
  const source = cleanString(value, 40).toLowerCase();
  return source === "dashboard" || source === "manual" || source === "scheduling" ? source : "scheduling";
}

function serializeNote(doc: any): SchedulingDayNoteRecord | null {
  const data = (typeof doc?.data === "function" ? doc.data() : doc?.data) || {};
  const landlordId = cleanString(data.landlordId, 240);
  const date = cleanString(data.date, 32);
  const noteText = cleanString(data.noteText, MAX_NOTE_TEXT_LENGTH);
  const status = cleanString(data.status, 40) === "deleted" ? "deleted" : "active";
  if (!landlordId || !parseDateKey(date) || !noteText) return null;
  return {
    noteId: cleanString(data.noteId, 240) || cleanString(doc?.id, 240),
    landlordId,
    date,
    noteText,
    source: normalizeSchedulingDayNoteSource(data.source),
    status,
    createdAt: cleanString(data.createdAt, 80),
    createdBy: cleanString(data.createdBy, 240),
    createdByEmail: cleanString(data.createdByEmail, 320) || null,
    updatedAt: cleanString(data.updatedAt, 80),
    updatedBy: cleanString(data.updatedBy, 240),
    updatedByEmail: cleanString(data.updatedByEmail, 320) || null,
    deletedAt: cleanString(data.deletedAt, 80) || null,
    deletedBy: cleanString(data.deletedBy, 240) || null,
    deletedByEmail: cleanString(data.deletedByEmail, 320) || null,
  };
}

function sortNotes(left: SchedulingDayNoteRecord, right: SchedulingDayNoteRecord): number {
  return (
    left.date.localeCompare(right.date) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.noteId.localeCompare(right.noteId)
  );
}

export function groupSchedulingDayNotesByDate(notes: SchedulingDayNoteRecord[]): SchedulingDayNotesByDate {
  return notes.reduce<SchedulingDayNotesByDate>((result, note) => {
    result[note.date] = [...(result[note.date] || []), note];
    return result;
  }, {});
}

export async function listSchedulingDayNotesForLandlord(params: {
  landlordId: string;
  startDate: string;
  endDate: string;
}): Promise<SchedulingDayNoteRecord[]> {
  const landlordId = cleanString(params.landlordId, 240);
  if (!landlordId) {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_LANDLORD_REQUIRED", "landlordId is required", 401);
  }
  const { startDate, endDate } = assertSchedulingDateRange(params.startDate, params.endDate);
  const snap = await db.collection(SCHEDULING_DAY_NOTES_COLLECTION).where("landlordId", "==", landlordId).get();
  return (snap.docs || [])
    .map(serializeNote)
    .filter((note): note is SchedulingDayNoteRecord => {
      return Boolean(note && note.status === "active" && note.date >= startDate && note.date <= endDate);
    })
    .sort(sortNotes);
}

export async function createSchedulingDayNote(params: {
  landlordId: string;
  date: string;
  noteText: string;
  source?: SchedulingDayNoteSource | string | null;
  actor: SchedulingDayNoteActor;
}): Promise<SchedulingDayNoteRecord> {
  const landlordId = cleanString(params.landlordId, 240);
  if (!landlordId) {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_LANDLORD_REQUIRED", "landlordId is required", 401);
  }
  const date = assertSchedulingDate(params.date);
  const noteText = normalizeSchedulingDayNoteText(params.noteText);
  const source = normalizeSchedulingDayNoteSource(params.source);
  const noteId = randomUUID();
  const timestamp = nowIso();
  const actorId = cleanString(params.actor?.id, 240) || landlordId;
  const actorEmail = cleanString(params.actor?.email, 320) || null;
  const record: SchedulingDayNoteRecord = {
    noteId,
    landlordId,
    date,
    noteText,
    source,
    status: "active",
    createdAt: timestamp,
    createdBy: actorId,
    createdByEmail: actorEmail,
    updatedAt: timestamp,
    updatedBy: actorId,
    updatedByEmail: actorEmail,
  };
  await db.collection(SCHEDULING_DAY_NOTES_COLLECTION).doc(noteId).set(record);
  return record;
}

async function loadOwnedNote(params: {
  landlordId: string;
  date: string;
  noteId: string;
}): Promise<SchedulingDayNoteRecord> {
  const landlordId = cleanString(params.landlordId, 240);
  const date = assertSchedulingDate(params.date);
  const noteId = cleanString(params.noteId, 240);
  if (!noteId) {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_ID_REQUIRED", "noteId is required");
  }
  const snap = await db.collection(SCHEDULING_DAY_NOTES_COLLECTION).doc(noteId).get();
  const note = snap.exists ? serializeNote(snap) : null;
  if (!note || note.landlordId !== landlordId || note.date !== date || note.status !== "active") {
    throw new SchedulingDayNotesValidationError("SCHEDULING_DAY_NOTE_NOT_FOUND", "Scheduling day note not found", 404);
  }
  return note;
}

export async function updateSchedulingDayNote(params: {
  landlordId: string;
  date: string;
  noteId: string;
  noteText: string;
  source?: SchedulingDayNoteSource | string | null;
  actor: SchedulingDayNoteActor;
}): Promise<SchedulingDayNoteRecord> {
  const current = await loadOwnedNote(params);
  const noteText = normalizeSchedulingDayNoteText(params.noteText);
  const source = normalizeSchedulingDayNoteSource(params.source || current.source);
  const timestamp = nowIso();
  const actorId = cleanString(params.actor?.id, 240) || params.landlordId;
  const actorEmail = cleanString(params.actor?.email, 320) || null;
  const next: SchedulingDayNoteRecord = {
    ...current,
    noteText,
    source,
    updatedAt: timestamp,
    updatedBy: actorId,
    updatedByEmail: actorEmail,
  };
  await db.collection(SCHEDULING_DAY_NOTES_COLLECTION).doc(current.noteId).set(next, { merge: true });
  return next;
}

export async function deleteSchedulingDayNote(params: {
  landlordId: string;
  date: string;
  noteId: string;
  actor: SchedulingDayNoteActor;
}): Promise<SchedulingDayNoteRecord> {
  const current = await loadOwnedNote(params);
  const timestamp = nowIso();
  const actorId = cleanString(params.actor?.id, 240) || params.landlordId;
  const actorEmail = cleanString(params.actor?.email, 320) || null;
  const next: SchedulingDayNoteRecord = {
    ...current,
    status: "deleted",
    updatedAt: timestamp,
    updatedBy: actorId,
    updatedByEmail: actorEmail,
    deletedAt: timestamp,
    deletedBy: actorId,
    deletedByEmail: actorEmail,
  };
  await db.collection(SCHEDULING_DAY_NOTES_COLLECTION).doc(current.noteId).set(next, { merge: true });
  return next;
}
