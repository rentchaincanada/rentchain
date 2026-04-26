import crypto from "crypto";
import type { ResolutionNoteV1, ResolutionRecordV1 } from "./resolutionTypes";
import { saveResolutionRecord } from "./saveResolutionRecord";

function toIsoNow() {
  return new Date().toISOString();
}

export async function addResolutionNote(
  record: ResolutionRecordV1,
  input: {
    message: string;
    authorId?: string | null;
    authorRole?: string | null;
  }
) {
  const now = toIsoNow();
  const note: ResolutionNoteV1 = {
    id: crypto.randomUUID(),
    createdAt: now,
    authorId: input.authorId ?? null,
    authorRole: input.authorRole ?? null,
    message: String(input.message || "").trim(),
  };
  const next: ResolutionRecordV1 = {
    ...record,
    updatedAt: now,
    notes: [...(Array.isArray(record.notes) ? record.notes : []), note],
  };
  return await saveResolutionRecord(next);
}
