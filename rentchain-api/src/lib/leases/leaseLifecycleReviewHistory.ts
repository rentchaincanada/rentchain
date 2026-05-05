import crypto from "crypto";
import type { LeaseLifecycleReviewItemWithAcknowledgement } from "./leaseLifecycleReviewAcknowledgements";
import type {
  LeaseLifecycleReviewAcknowledgement,
  LeaseLifecycleReviewAcknowledgementPatch,
  LeaseLifecycleReviewAcknowledgementStatus,
} from "./leaseLifecycleReviewAcknowledgements";

export const LEASE_LIFECYCLE_REVIEW_HISTORY_COLLECTION = "leaseLifecycleReviewHistory";

export type LeaseLifecycleReviewHistoryAction = "reviewed" | "snoozed" | "assigned" | "reopened" | "note_updated";

export type LeaseLifecycleReviewHistoryEvent = {
  historyId: string;
  reviewItemId: string;
  leaseId: string;
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
  action: LeaseLifecycleReviewHistoryAction;
  previousStatus?: LeaseLifecycleReviewAcknowledgementStatus | null;
  nextStatus: LeaseLifecycleReviewAcknowledgementStatus;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  note?: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  createdAt: string;
};

function asString(value: unknown, max = 1000): string {
  return String(value || "").trim().slice(0, max);
}

function toIsoDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function actionForPatch(input: {
  patch: LeaseLifecycleReviewAcknowledgementPatch;
  existing?: LeaseLifecycleReviewAcknowledgement | null;
}): LeaseLifecycleReviewHistoryAction {
  if (input.patch.status === "open") return "reopened";
  if (input.existing?.status === input.patch.status && asString(input.patch.note) !== asString(input.existing?.note)) {
    return "note_updated";
  }
  return input.patch.status;
}

export function buildLeaseLifecycleReviewHistoryEvent(input: {
  item: LeaseLifecycleReviewItemWithAcknowledgement;
  acknowledgement: LeaseLifecycleReviewAcknowledgement;
  patch: LeaseLifecycleReviewAcknowledgementPatch;
  existing?: LeaseLifecycleReviewAcknowledgement | null;
  actorId?: string | null;
  actorEmail?: string | null;
  now?: string;
}): LeaseLifecycleReviewHistoryEvent {
  const createdAt = toIsoDate(input.now) || new Date().toISOString();
  const action = actionForPatch({ patch: input.patch, existing: input.existing });
  const historySeed = `${input.item.id}:${createdAt}:${input.acknowledgement.status}:${crypto.randomUUID()}`;
  return {
    historyId: crypto.createHash("sha256").update(historySeed).digest("hex"),
    reviewItemId: input.item.id,
    leaseId: input.item.leaseId,
    landlordId: input.item.landlordId,
    propertyId: input.item.propertyId,
    unitId: input.item.unitId,
    action,
    previousStatus: input.existing?.status || null,
    nextStatus: input.acknowledgement.status,
    assignedTo: input.acknowledgement.assignedTo || null,
    snoozedUntil: input.acknowledgement.snoozedUntil || null,
    note: input.acknowledgement.note || null,
    actorId: asString(input.actorId, 240) || null,
    actorEmail: asString(input.actorEmail, 320) || null,
    createdAt,
  };
}

export function normalizeLeaseLifecycleReviewHistoryEvent(raw: unknown): LeaseLifecycleReviewHistoryEvent | null {
  const data = (raw || {}) as Record<string, unknown>;
  const historyId = asString(data.historyId || data.id, 240);
  const reviewItemId = asString(data.reviewItemId, 4000);
  const leaseId = asString(data.leaseId, 240);
  const action = asString(data.action, 40) as LeaseLifecycleReviewHistoryAction;
  const nextStatus = asString(data.nextStatus, 40) as LeaseLifecycleReviewAcknowledgementStatus;
  const createdAt = toIsoDate(data.createdAt);
  if (!historyId || !reviewItemId || !leaseId || !createdAt) return null;
  if (!["reviewed", "snoozed", "assigned", "reopened", "note_updated"].includes(action)) return null;
  if (!["open", "reviewed", "snoozed", "assigned"].includes(nextStatus)) return null;
  return {
    historyId,
    reviewItemId,
    leaseId,
    landlordId: asString(data.landlordId, 240) || null,
    propertyId: asString(data.propertyId, 240) || null,
    unitId: asString(data.unitId, 240) || null,
    action,
    previousStatus: (asString(data.previousStatus, 40) as LeaseLifecycleReviewAcknowledgementStatus) || null,
    nextStatus,
    assignedTo: asString(data.assignedTo, 240) || null,
    snoozedUntil: toIsoDate(data.snoozedUntil),
    note: asString(data.note, 1000) || null,
    actorId: asString(data.actorId, 240) || null,
    actorEmail: asString(data.actorEmail, 320) || null,
    createdAt,
  };
}

export function mergeLeaseLifecycleReviewHistory<T extends LeaseLifecycleReviewItemWithAcknowledgement>(
  items: T[],
  history: unknown[],
  limitPerItem = 3
): Array<T & { recentHistory: LeaseLifecycleReviewHistoryEvent[] }> {
  const byReviewItemId = new Map<string, LeaseLifecycleReviewHistoryEvent[]>();
  for (const raw of Array.isArray(history) ? history : []) {
    const event = normalizeLeaseLifecycleReviewHistoryEvent(raw);
    if (!event) continue;
    const list = byReviewItemId.get(event.reviewItemId) || [];
    list.push(event);
    byReviewItemId.set(event.reviewItemId, list);
  }

  for (const list of byReviewItemId.values()) {
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  return items.map((item) => ({
    ...item,
    recentHistory: (byReviewItemId.get(item.id) || []).slice(0, limitPerItem),
  }));
}
