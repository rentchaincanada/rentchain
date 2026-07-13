import crypto from "crypto";
import { db } from "../firebase";
import { CANONICAL_EVENTS_COLLECTION, buildEvent } from "../lib/events/buildEvent";
import {
  RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION,
  type RenewalNoticeCommunicationRecord,
  type RenewalNoticeDeliveryStatus,
} from "./renewalNoticeCommunicationService";

export const COMMUNICATION_PROVIDER_EVENT_RECEIPTS_COLLECTION = "communicationProviderEventReceipts";

type MailgunWebhookBody = {
  signature?: {
    timestamp?: unknown;
    token?: unknown;
    signature?: unknown;
  };
  "event-data"?: Record<string, any>;
};

type MailgunDeliveryWebhookResult =
  | {
      ok: true;
      statusCode: 200;
      duplicate?: boolean;
      matched?: boolean;
      updated?: boolean;
      ignoredReason?: string | null;
      communicationId?: string | null;
      deliveryStatus?: RenewalNoticeDeliveryStatus | null;
      receiptId?: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

const DEFAULT_REPLAY_WINDOW_SECONDS = 24 * 60 * 60;

function asString(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeReason(value: string): string {
  return asString(value, 160).replace(/[^a-zA-Z0-9_.:-]/g, "_") || "mailgun_event";
}

function safeEventType(value: unknown): string {
  return asString(value, 80).toLowerCase().replace(/[^a-z0-9_.:-]/g, "_");
}

function safeId(value: unknown, max = 240): string {
  return asString(value, max).replace(/[^\w@.<>:+-]/g, "");
}

function normalizeProviderMessageId(value: unknown): string {
  const raw = safeId(value, 320);
  if (!raw) return "";
  const bracketed = raw.match(/<[^>\s]+@[^>\s]+>/)?.[0];
  if (bracketed) return bracketed;
  if (raw.includes("@") && !raw.startsWith("<") && !raw.endsWith(">")) return `<${raw}>`;
  return raw;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  const raw = asString(value, 80);
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return new Date(numeric * 1000).toISOString();
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return null;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyMailgunWebhookSignature(input: {
  signature: MailgunWebhookBody["signature"];
  signingKey: string;
  now?: Date;
  replayWindowSeconds?: number;
}): { ok: true; timestamp: string; token: string } | { ok: false; error: string; statusCode: number } {
  const timestamp = asString(input.signature?.timestamp, 80);
  const token = asString(input.signature?.token, 240);
  const signature = asString(input.signature?.signature, 240);
  const signingKey = asString(input.signingKey, 500);
  if (!signingKey) return { ok: false, statusCode: 503, error: "MAILGUN_WEBHOOK_SIGNING_KEY_REQUIRED" };
  if (!timestamp || !token || !signature) {
    return { ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_REQUIRED" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" };
  }
  const replayWindowSeconds = input.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS;
  const nowMs = (input.now || new Date()).getTime();
  if (replayWindowSeconds > 0 && Math.abs(nowMs - timestampSeconds * 1000) > replayWindowSeconds * 1000) {
    return { ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_STALE" };
  }

  const expected = crypto.createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");
  if (!timingSafeEqualHex(signature, expected)) {
    return { ok: false, statusCode: 401, error: "MAILGUN_WEBHOOK_SIGNATURE_INVALID" };
  }
  return { ok: true, timestamp, token };
}

export function normalizeMailgunDeliveryEvent(eventData: Record<string, any>): {
  eventType: string;
  deliveryStatus: RenewalNoticeDeliveryStatus | null;
  reason: string;
  ignoredReason: string | null;
  eventTimestamp: string | null;
  providerEventId: string | null;
  providerMessageId: string | null;
  communicationId: string | null;
} {
  const eventType = safeEventType(eventData?.event);
  const severity = safeEventType(eventData?.severity);
  const userVariables = eventData?.["user-variables"] || eventData?.userVariables || {};
  const communicationId =
    safeId(userVariables.communicationId || userVariables.communication_id || eventData?.communicationId, 240) || null;
  const providerMessageId =
    normalizeProviderMessageId(
      eventData?.message?.headers?.["message-id"] ||
        eventData?.message?.headers?.["Message-Id"] ||
        eventData?.message?.["message-id"] ||
        eventData?.["message-id"]
    ) || null;
  const providerEventId = safeId(eventData?.id || eventData?.eventId || eventData?.["event-id"], 240) || null;
  const eventTimestamp = toIsoTimestamp(eventData?.timestamp) || null;

  if (eventType === "accepted") {
    return {
      eventType,
      deliveryStatus: "accepted_for_sending",
      reason: "mailgun_event_accepted",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "delivered") {
    return {
      eventType,
      deliveryStatus: "delivered",
      reason: "mailgun_event_delivered",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "failed" && severity === "temporary") {
    return {
      eventType,
      deliveryStatus: "deferred",
      reason: "mailgun_event_failed_temporary",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "failed" && severity === "permanent") {
    return {
      eventType,
      deliveryStatus: "bounced",
      reason: "mailgun_event_failed_permanent",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "failed") {
    return {
      eventType,
      deliveryStatus: "failed",
      reason: "mailgun_event_failed",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "complained") {
    return {
      eventType,
      deliveryStatus: "complained",
      reason: "mailgun_event_complained",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  if (eventType === "rejected") {
    return {
      eventType,
      deliveryStatus: "rejected",
      reason: "mailgun_event_rejected",
      ignoredReason: null,
      eventTimestamp,
      providerEventId,
      providerMessageId,
      communicationId,
    };
  }
  return {
    eventType: eventType || "unknown",
    deliveryStatus: null,
    reason: "mailgun_event_ignored",
    ignoredReason: eventType ? `unsupported_event:${safeReason(eventType)}` : "missing_event_type",
    eventTimestamp,
    providerEventId,
    providerMessageId,
    communicationId,
  };
}

function receiptIdFor(input: { eventId?: string | null; token: string; timestamp: string; eventType: string }): string {
  const key = ["mailgun", input.eventId || "", input.timestamp, input.token, input.eventType].join(":");
  return `mailgun_${sha256(key).slice(0, 64)}`;
}

function deliveryStatusRank(value: unknown): number {
  const raw = asString(value, 80);
  if (raw === "complained") return 6;
  if (raw === "bounced" || raw === "failed" || raw === "rejected") return 5;
  if (raw === "delivered") return 4;
  if (raw === "deferred") return 3;
  if (raw === "sent" || raw === "queued") return 2;
  if (raw === "accepted_for_sending") return 1;
  return 0;
}

function shouldApplyDeliveryStatus(current: unknown, next: RenewalNoticeDeliveryStatus): boolean {
  const currentRank = deliveryStatusRank(current);
  const nextRank = deliveryStatusRank(next);
  if (nextRank === 0) return false;
  return nextRank >= currentRank;
}

async function findCommunication(input: {
  communicationId?: string | null;
  providerMessageId?: string | null;
}): Promise<{ ref: any; record: RenewalNoticeCommunicationRecord & { id?: string } } | null | "ambiguous"> {
  if (input.communicationId) {
    const ref = db.collection(RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION).doc(input.communicationId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { ref, record: { id: snap.id, ...(snap.data() as RenewalNoticeCommunicationRecord) } };
  }
  if (!input.providerMessageId) return null;

  const query = await db
    .collection(RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION)
    .where("provider", "==", "mailgun")
    .where("providerMessageId", "==", input.providerMessageId)
    .limit(2)
    .get();
  if (query.empty || !query.docs?.length) return null;
  if (query.docs.length > 1) return "ambiguous";
  const doc = query.docs[0];
  return {
    ref: db.collection(RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION).doc(doc.id),
    record: { id: doc.id, ...(doc.data() as RenewalNoticeCommunicationRecord) },
  };
}

function deliveryStatusSummary(input: {
  deliveryStatus: RenewalNoticeDeliveryStatus;
  eventType: string;
}): string {
  if (input.deliveryStatus === "delivered") {
    return "Renewal tenant communication delivery confirmation updated from Mailgun webhook. Not served; legal service not established.";
  }
  if (input.deliveryStatus === "complained") {
    return "Renewal tenant communication complaint reported by email provider. Not served; legal service not established.";
  }
  if (input.deliveryStatus === "bounced" || input.deliveryStatus === "failed" || input.deliveryStatus === "rejected") {
    return "Renewal tenant communication delivery issue reported by email provider. Not served; legal service not established.";
  }
  if (input.deliveryStatus === "deferred") {
    return "Renewal tenant communication temporary delivery issue reported by email provider. Not served; legal service not established.";
  }
  return "Renewal tenant communication delivery status updated from Mailgun webhook. Not served; legal service not established.";
}

async function writeDeliveryStatusEvent(input: {
  record: RenewalNoticeCommunicationRecord;
  deliveryStatus: RenewalNoticeDeliveryStatus;
  reason: string;
  eventType: string;
  providerEventId: string | null;
  providerMessageId: string | null;
  occurredAt: string;
}) {
  const eventRef = db.collection("events").doc();
  const canonicalEventId = `renewal_notice_delivery_status_updated:${input.record.communicationId}:${input.occurredAt}:${input.deliveryStatus}`;
  const summary = deliveryStatusSummary({ deliveryStatus: input.deliveryStatus, eventType: input.eventType });
  const legacyEvent = {
    id: eventRef.id,
    landlordId: input.record.landlordId,
    actorUserId: null,
    type: "renewal_notice_delivery_status_updated",
    leaseId: input.record.leaseId,
    tenantId: input.record.tenantId || undefined,
    propertyId: input.record.propertyId || undefined,
    payload: {
      communicationId: input.record.communicationId,
      snapshotId: input.record.snapshotId,
      approvalDecisionItemId: input.record.approvalDecisionItemId,
      status: input.record.status,
      deliveryStatus: input.deliveryStatus,
      provider: "mailgun",
      providerMessageId: input.providerMessageId || input.record.providerMessageId || null,
      providerEventId: input.providerEventId,
      providerEventType: input.eventType,
      deliveryStatusSource: "mailgun_webhook",
      deliveryStatusReason: input.reason,
      deliveryStatusUpdatedAt: input.occurredAt,
      lastProviderEventAt: input.occurredAt,
      noLegalServiceClaim: true,
      noticeServed: false,
      tenantNotified: input.record.tenantNotified,
      legalServiceEstablished: false,
      summary,
    },
    summary,
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt,
  };
  const canonicalEvent = buildEvent({
    id: canonicalEventId,
    type: "renewal_notice_delivery_status_updated",
    domain: "lease",
    action: "renewal_notice_delivery_status_updated",
    status: "completed",
    actor: { type: "system", id: "mailgun", role: "provider", displayName: "Mailgun" },
    resource: {
      type: "lease",
      id: input.record.leaseId,
      parentType: input.record.propertyId ? "property" : null,
      parentId: input.record.propertyId,
    },
    occurredAt: input.occurredAt,
    visibility: "landlord",
    summary,
    metadata: {
      landlordId: input.record.landlordId,
      leaseId: input.record.leaseId,
      tenantId: input.record.tenantId,
      propertyId: input.record.propertyId,
      unitId: input.record.unitId,
      communicationId: input.record.communicationId,
      snapshotId: input.record.snapshotId,
      approvalDecisionItemId: input.record.approvalDecisionItemId,
      deliveryStatus: input.deliveryStatus,
      provider: "mailgun",
      providerMessageId: input.providerMessageId || input.record.providerMessageId || null,
      providerEventId: input.providerEventId,
      providerEventType: input.eventType,
      deliveryStatusSource: "mailgun_webhook",
      deliveryStatusReason: input.reason,
      deliveryStatusUpdatedAt: input.occurredAt,
      lastProviderEventAt: input.occurredAt,
      noLegalServiceClaim: true,
      noticeServed: false,
      tenantNotified: input.record.tenantNotified,
      legalServiceEstablished: false,
    },
    tags: ["renewal_notice", "tenant_communication", "delivery_status", "mailgun_webhook"],
  });
  const batch = db.batch();
  batch.set(eventRef, legacyEvent);
  batch.set(db.collection(CANONICAL_EVENTS_COLLECTION).doc(canonicalEvent.id), canonicalEvent);
  await batch.commit();
  return { auditEventId: eventRef.id, canonicalEventId };
}

export async function handleMailgunRenewalCommunicationWebhook(input: {
  body: MailgunWebhookBody;
  signingKey: string;
  replayWindowSeconds?: number;
  now?: Date;
}): Promise<MailgunDeliveryWebhookResult> {
  const verified = verifyMailgunWebhookSignature({
    signature: input.body?.signature,
    signingKey: input.signingKey,
    replayWindowSeconds: input.replayWindowSeconds,
    now: input.now,
  });
  if (!verified.ok) return verified;

  const eventData = input.body?.["event-data"];
  if (!eventData || typeof eventData !== "object") {
    return { ok: false, statusCode: 400, error: "MAILGUN_WEBHOOK_EVENT_DATA_REQUIRED" };
  }
  const normalized = normalizeMailgunDeliveryEvent(eventData);
  const receiptId = receiptIdFor({
    eventId: normalized.providerEventId,
    token: verified.token,
    timestamp: verified.timestamp,
    eventType: normalized.eventType,
  });
  const receiptRef = db.collection(COMMUNICATION_PROVIDER_EVENT_RECEIPTS_COLLECTION).doc(receiptId);
  const existingReceipt = await receiptRef.get();
  if (existingReceipt.exists) {
    const existing = existingReceipt.data() || {};
    return {
      ok: true,
      statusCode: 200,
      duplicate: true,
      matched: existing.reconciliationState === "matched",
      updated: false,
      ignoredReason: existing.ignoredReason || null,
      communicationId: existing.communicationId || null,
      deliveryStatus: existing.deliveryStatus || null,
      receiptId,
    };
  }

  const receivedAt = (input.now || new Date()).toISOString();
  const eventTimestamp = normalized.eventTimestamp || receivedAt;
  const payloadHash = sha256(JSON.stringify(eventData));
  const receiptBase = {
    receiptId,
    provider: "mailgun",
    providerEventId: normalized.providerEventId,
    providerMessageId: normalized.providerMessageId,
    eventType: normalized.eventType,
    eventTimestamp,
    receivedAt,
    signatureVerified: true,
    redactedPayloadHash: payloadHash,
    deliveryStatus: normalized.deliveryStatus,
    communicationId: normalized.communicationId,
    reconciliationState: "received",
    ignoredReason: normalized.ignoredReason,
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };

  if (normalized.ignoredReason || !normalized.deliveryStatus) {
    await receiptRef.set({ ...receiptBase, reconciliationState: "ignored" }, { merge: false });
    return {
      ok: true,
      statusCode: 200,
      matched: false,
      updated: false,
      ignoredReason: normalized.ignoredReason,
      deliveryStatus: normalized.deliveryStatus,
      receiptId,
    };
  }

  const matched = await findCommunication({
    communicationId: normalized.communicationId,
    providerMessageId: normalized.providerMessageId,
  });
  if (matched === "ambiguous") {
    await receiptRef.set({ ...receiptBase, reconciliationState: "ambiguous", ignoredReason: "ambiguous_provider_message_id" }, { merge: false });
    return {
      ok: true,
      statusCode: 200,
      matched: false,
      updated: false,
      ignoredReason: "ambiguous_provider_message_id",
      deliveryStatus: normalized.deliveryStatus,
      receiptId,
    };
  }
  if (!matched) {
    await receiptRef.set({ ...receiptBase, reconciliationState: "unmatched", ignoredReason: "communication_not_found" }, { merge: false });
    return {
      ok: true,
      statusCode: 200,
      matched: false,
      updated: false,
      ignoredReason: "communication_not_found",
      deliveryStatus: normalized.deliveryStatus,
      receiptId,
    };
  }

  const record = matched.record;
  const communicationId = record.communicationId || matched.record.id || normalized.communicationId || null;
  if (!shouldApplyDeliveryStatus(record.deliveryStatus, normalized.deliveryStatus)) {
    await receiptRef.set(
      {
        ...receiptBase,
        communicationId,
        reconciliationState: "ignored",
        ignoredReason: "delivery_status_precedence_noop",
      },
      { merge: false }
    );
    return {
      ok: true,
      statusCode: 200,
      matched: true,
      updated: false,
      ignoredReason: "delivery_status_precedence_noop",
      communicationId,
      deliveryStatus: normalized.deliveryStatus,
      receiptId,
    };
  }

  const eventIds = Array.from(new Set([...(record.deliveryEventIds || []), receiptId]));
  const eventIdsForRecord = eventIds.slice(-50);
  const eventResult = await writeDeliveryStatusEvent({
    record,
    deliveryStatus: normalized.deliveryStatus,
    reason: normalized.reason,
    eventType: normalized.eventType,
    providerEventId: normalized.providerEventId,
    providerMessageId: normalized.providerMessageId,
    occurredAt: eventTimestamp,
  });
  await matched.ref.set(
    {
      deliveryStatus: normalized.deliveryStatus,
      deliveryStatusUpdatedAt: eventTimestamp,
      deliveryStatusSource: "mailgun_webhook",
      deliveryStatusReason: normalized.reason,
      providerMessageId: normalized.providerMessageId || record.providerMessageId || null,
      lastProviderEventAt: eventTimestamp,
      deliveryEventIds: eventIdsForRecord,
      updatedAt: receivedAt,
      auditEventIds: Array.from(new Set([...(record.auditEventIds || []), eventResult.auditEventId])),
      canonicalEventIds: Array.from(new Set([...(record.canonicalEventIds || []), eventResult.canonicalEventId])),
      noticeServed: false,
      legalServiceEstablished: false,
      noLegalServiceClaim: true,
    },
    { merge: true }
  );
  await receiptRef.set(
    {
      ...receiptBase,
      communicationId,
      reconciliationState: "matched",
      ignoredReason: null,
      updatedCommunication: true,
      auditEventId: eventResult.auditEventId,
      canonicalEventId: eventResult.canonicalEventId,
    },
    { merge: false }
  );
  return {
    ok: true,
    statusCode: 200,
    matched: true,
    updated: true,
    communicationId,
    deliveryStatus: normalized.deliveryStatus,
    receiptId,
  };
}

export const __testing = {
  receiptIdFor,
  deliveryStatusRank,
  shouldApplyDeliveryStatus,
  normalizeProviderMessageId,
};
