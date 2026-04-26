import crypto from "crypto";
import { assignmentRecordId, loadAssignmentRecord } from "./loadAssignmentRecord";
import { saveAssignmentRecord } from "./saveAssignmentRecord";
import type { AssignmentHistoryEntryV1, AssignmentRecordV1 } from "./assignmentTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toIsoNow() {
  return new Date().toISOString();
}

function buildHistoryEntry(input: {
  action: AssignmentHistoryEntryV1["action"];
  fromOwnerId?: string | null;
  fromOwnerLabel?: string | null;
  toOwnerId?: string | null;
  toOwnerLabel?: string | null;
  authorId?: string | null;
  authorRole?: string | null;
  note?: string | null;
}): AssignmentHistoryEntryV1 {
  return {
    id: crypto.randomUUID(),
    timestamp: toIsoNow(),
    action: input.action,
    fromOwnerId: input.fromOwnerId ?? null,
    fromOwnerLabel: input.fromOwnerLabel ?? null,
    toOwnerId: input.toOwnerId ?? null,
    toOwnerLabel: input.toOwnerLabel ?? null,
    authorId: input.authorId ?? null,
    authorRole: input.authorRole ?? null,
    note: input.note ?? null,
  };
}

export async function setAssignmentOwner(input: {
  resourceType: string;
  resourceId: string;
  ownerId?: string | null;
  ownerLabel?: string | null;
  authorId?: string | null;
  authorRole?: string | null;
  note?: string | null;
}) {
  const resourceType = asString(input.resourceType, 120);
  const resourceId = asString(input.resourceId, 240);
  const ownerId = asString(input.ownerId, 240) || null;
  const ownerLabel = asString(input.ownerLabel, 240) || null;
  const note = asString(input.note, 2000) || null;
  if (!resourceType || !resourceId) {
    throw new Error("ASSIGNMENT_RESOURCE_REQUIRED");
  }

  const existing = await loadAssignmentRecord({ resourceType, resourceId });
  const now = toIsoNow();

  if (!existing) {
    const record: AssignmentRecordV1 = {
      version: "v1",
      id: assignmentRecordId(resourceType, resourceId),
      resource: {
        type: resourceType,
        id: resourceId,
      },
      currentOwner: {
        ownerId,
        ownerLabel,
      },
      createdAt: now,
      updatedAt: now,
      history: [
        buildHistoryEntry({
          action: ownerId ? "set" : "cleared",
          toOwnerId: ownerId,
          toOwnerLabel: ownerLabel,
          authorId: input.authorId,
          authorRole: input.authorRole,
          note,
        }),
      ],
      metadata: {},
    };
    return await saveAssignmentRecord(record);
  }

  const priorOwnerId = asString(existing.currentOwner?.ownerId, 240) || null;
  const priorOwnerLabel = asString(existing.currentOwner?.ownerLabel, 240) || null;
  const action: AssignmentHistoryEntryV1["action"] = !ownerId
    ? "cleared"
    : !priorOwnerId
    ? "set"
    : priorOwnerId !== ownerId || priorOwnerLabel !== ownerLabel
    ? "changed"
    : "changed";

  const next: AssignmentRecordV1 = {
    ...existing,
    currentOwner: {
      ownerId,
      ownerLabel,
    },
    updatedAt: now,
    history: [
      ...(Array.isArray(existing.history) ? existing.history : []),
      buildHistoryEntry({
        action,
        fromOwnerId: priorOwnerId,
        fromOwnerLabel: priorOwnerLabel,
        toOwnerId: ownerId,
        toOwnerLabel: ownerLabel,
        authorId: input.authorId,
        authorRole: input.authorRole,
        note,
      }),
    ],
  };
  return await saveAssignmentRecord(next);
}
