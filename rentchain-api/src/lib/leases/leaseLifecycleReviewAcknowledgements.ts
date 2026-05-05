import crypto from "crypto";
import type { LeaseLifecycleReviewItem, LeaseLifecycleReviewQueueResult } from "./leaseLifecycleReviewQueue";

export const LEASE_LIFECYCLE_REVIEW_ACKNOWLEDGEMENTS_COLLECTION = "leaseLifecycleReviewAcknowledgements";

export type LeaseLifecycleReviewAcknowledgementStatus = "open" | "reviewed" | "snoozed" | "assigned";

export type LeaseLifecycleReviewAcknowledgement = {
  acknowledgementId: string;
  reviewItemId: string;
  leaseId: string;
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
  status: LeaseLifecycleReviewAcknowledgementStatus;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  note?: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string;
  updatedAt: string;
};

export type LeaseLifecycleReviewAcknowledgementPatch = {
  status: LeaseLifecycleReviewAcknowledgementStatus;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  note?: string | null;
};

export type LeaseLifecycleReviewItemWithAcknowledgement = LeaseLifecycleReviewItem & {
  acknowledgement: LeaseLifecycleReviewAcknowledgement | null;
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

export function leaseLifecycleReviewAcknowledgementId(reviewItemId: string): string {
  return crypto.createHash("sha256").update(asString(reviewItemId, 4000)).digest("hex");
}

export function normalizeLeaseLifecycleReviewAcknowledgement(raw: unknown): LeaseLifecycleReviewAcknowledgement | null {
  const data = (raw || {}) as Record<string, unknown>;
  const reviewItemId = asString(data.reviewItemId, 4000);
  const leaseId = asString(data.leaseId, 240);
  const status = asString(data.status, 40) as LeaseLifecycleReviewAcknowledgementStatus;
  if (!reviewItemId || !leaseId || !["open", "reviewed", "snoozed", "assigned"].includes(status)) return null;
  return {
    acknowledgementId: asString(data.acknowledgementId, 240) || leaseLifecycleReviewAcknowledgementId(reviewItemId),
    reviewItemId,
    leaseId,
    landlordId: asString(data.landlordId, 240) || null,
    propertyId: asString(data.propertyId, 240) || null,
    unitId: asString(data.unitId, 240) || null,
    status,
    assignedTo: asString(data.assignedTo, 240) || null,
    snoozedUntil: toIsoDate(data.snoozedUntil),
    note: asString(data.note, 1000) || null,
    acknowledgedBy: asString(data.acknowledgedBy, 240) || null,
    acknowledgedAt: toIsoDate(data.acknowledgedAt) || new Date(0).toISOString(),
    updatedAt: toIsoDate(data.updatedAt) || new Date(0).toISOString(),
  };
}

export function buildLeaseLifecycleReviewAcknowledgement(input: {
  item: LeaseLifecycleReviewItem;
  patch: LeaseLifecycleReviewAcknowledgementPatch;
  acknowledgedBy?: string | null;
  now?: string;
  existing?: LeaseLifecycleReviewAcknowledgement | null;
}): LeaseLifecycleReviewAcknowledgement {
  const now = toIsoDate(input.now) || new Date().toISOString();
  const status = input.patch.status;
  const assignedTo = status === "assigned" ? asString(input.patch.assignedTo, 240) || null : null;
  const snoozedUntil = status === "snoozed" ? toIsoDate(input.patch.snoozedUntil) : null;
  return {
    acknowledgementId: input.existing?.acknowledgementId || leaseLifecycleReviewAcknowledgementId(input.item.id),
    reviewItemId: input.item.id,
    leaseId: input.item.leaseId,
    landlordId: input.item.landlordId,
    propertyId: input.item.propertyId,
    unitId: input.item.unitId,
    status,
    assignedTo,
    snoozedUntil,
    note: asString(input.patch.note, 1000) || null,
    acknowledgedBy: asString(input.acknowledgedBy, 240) || null,
    acknowledgedAt: input.existing?.acknowledgedAt || now,
    updatedAt: now,
  };
}

export function mergeLeaseLifecycleReviewAcknowledgements(
  queue: LeaseLifecycleReviewQueueResult,
  acknowledgements: unknown[]
): LeaseLifecycleReviewQueueResult & { items: LeaseLifecycleReviewItemWithAcknowledgement[] } {
  const byReviewItemId = new Map<string, LeaseLifecycleReviewAcknowledgement>();
  for (const raw of Array.isArray(acknowledgements) ? acknowledgements : []) {
    const acknowledgement = normalizeLeaseLifecycleReviewAcknowledgement(raw);
    if (acknowledgement) byReviewItemId.set(acknowledgement.reviewItemId, acknowledgement);
  }

  return {
    ...queue,
    items: queue.items.map((item) => ({
      ...item,
      acknowledgement: byReviewItemId.get(item.id) || null,
    })),
  };
}
