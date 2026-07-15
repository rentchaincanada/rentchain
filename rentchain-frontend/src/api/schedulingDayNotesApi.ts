import { apiFetch } from "./apiFetch";
import type { SchedulingDayNote, SchedulingDayNotesByDate } from "../lib/schedulingDayNotes";

type ApiSchedulingDayNote = {
  noteId?: string;
  id?: string;
  date?: string;
  noteText?: string;
  text?: string;
  source?: "dashboard" | "scheduling" | "manual";
  createdAt?: string;
  updatedAt?: string;
};

type SchedulingDayNotesRangeResponse = {
  ok: true;
  notes?: ApiSchedulingDayNote[];
  notesByDate?: Record<string, ApiSchedulingDayNote[]>;
};

type SchedulingDayNotesSingleResponse = {
  ok: true;
  date: string;
  notes: ApiSchedulingDayNote[];
};

type SchedulingDayNoteMutationResponse = {
  ok: true;
  note: ApiSchedulingDayNote;
};

function normalizeNote(raw: ApiSchedulingDayNote): SchedulingDayNote | null {
  const text = String(raw.noteText ?? raw.text ?? "").trim();
  const id = String(raw.noteId ?? raw.id ?? "").trim();
  if (!text || !id) return null;
  return {
    id,
    text,
    date: raw.date,
    source: raw.source,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeNotesByDate(value: Record<string, ApiSchedulingDayNote[]> | undefined): SchedulingDayNotesByDate {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value).reduce<SchedulingDayNotesByDate>((result, [date, notes]) => {
    const normalized = Array.isArray(notes)
      ? notes.map(normalizeNote).filter((note): note is SchedulingDayNote => Boolean(note))
      : [];
    if (normalized.length) result[date] = normalized;
    return result;
  }, {});
}

function groupNotesByDate(notes: ApiSchedulingDayNote[] | undefined): SchedulingDayNotesByDate {
  if (!Array.isArray(notes)) return {};
  return notes.reduce<SchedulingDayNotesByDate>((result, raw) => {
    const note = normalizeNote(raw);
    const date = String(raw.date || note?.date || "").trim();
    if (!note || !date) return result;
    result[date] = [...(result[date] || []), note];
    return result;
  }, {});
}

export async function fetchSchedulingDayNotesRange(params: {
  startDate: string;
  endDate: string;
}): Promise<SchedulingDayNotesByDate> {
  const search = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const response = await apiFetch<SchedulingDayNotesRangeResponse>(`/landlord/scheduling/day-notes?${search.toString()}`);
  const grouped = normalizeNotesByDate(response.notesByDate);
  return Object.keys(grouped).length ? grouped : groupNotesByDate(response.notes);
}

export async function fetchSchedulingDayNotesForDate(date: string): Promise<SchedulingDayNote[]> {
  const response = await apiFetch<SchedulingDayNotesSingleResponse>(`/landlord/scheduling/day-notes/${date}`);
  return response.notes.map(normalizeNote).filter((note): note is SchedulingDayNote => Boolean(note));
}

export async function createSchedulingDayNote(
  date: string,
  payload: { noteText: string; source?: "dashboard" | "scheduling" | "manual" }
): Promise<SchedulingDayNote> {
  const response = await apiFetch<SchedulingDayNoteMutationResponse>(`/landlord/scheduling/day-notes/${date}`, {
    method: "POST",
    body: payload,
  });
  const note = normalizeNote(response.note);
  if (!note) throw new Error("Scheduling note response was invalid");
  return note;
}

export async function updateSchedulingDayNote(
  date: string,
  noteId: string,
  payload: { noteText: string; source?: "dashboard" | "scheduling" | "manual" }
): Promise<SchedulingDayNote> {
  const response = await apiFetch<SchedulingDayNoteMutationResponse>(
    `/landlord/scheduling/day-notes/${date}/${encodeURIComponent(noteId)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
  const note = normalizeNote(response.note);
  if (!note) throw new Error("Scheduling note response was invalid");
  return note;
}

export async function deleteSchedulingDayNote(date: string, noteId: string): Promise<void> {
  await apiFetch<SchedulingDayNoteMutationResponse>(
    `/landlord/scheduling/day-notes/${date}/${encodeURIComponent(noteId)}`,
    {
      method: "DELETE",
    }
  );
}
