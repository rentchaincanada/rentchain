import crypto from "crypto";
import type { ResolutionHistoryEntryV1, ResolutionRecordV1, ResolutionStatus } from "./resolutionTypes";
import { saveResolutionRecord } from "./saveResolutionRecord";
import { validateResolutionTransition } from "./validateResolutionTransition";

function toIsoNow() {
  return new Date().toISOString();
}

function historyEntry(input: {
  fromStatus?: ResolutionStatus | null;
  toStatus: ResolutionStatus;
  authorId?: string | null;
  authorRole?: string | null;
  reason?: string | null;
}): ResolutionHistoryEntryV1 {
  return {
    id: crypto.randomUUID(),
    timestamp: toIsoNow(),
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    authorId: input.authorId ?? null,
    authorRole: input.authorRole ?? null,
    reason: input.reason ?? null,
  };
}

export async function updateResolutionStatus(
  record: ResolutionRecordV1,
  input: {
    status: ResolutionStatus;
    authorId?: string | null;
    authorRole?: string | null;
    reason?: string | null;
  }
) {
  validateResolutionTransition(record.status, input.status);
  const now = toIsoNow();
  const next: ResolutionRecordV1 = {
    ...record,
    status: input.status,
    updatedAt: now,
    resolvedAt: input.status === "resolved" ? now : record.resolvedAt ?? null,
    dismissedAt: input.status === "dismissed" ? now : record.dismissedAt ?? null,
    history: [
      ...(Array.isArray(record.history) ? record.history : []),
      historyEntry({
        fromStatus: record.status,
        toStatus: input.status,
        authorId: input.authorId,
        authorRole: input.authorRole,
        reason: input.reason,
      }),
    ],
  };
  return await saveResolutionRecord(next);
}
