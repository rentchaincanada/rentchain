import crypto from "crypto";
import { db } from "../firebase";
import { CANONICAL_EVENTS_COLLECTION, buildEvent } from "../lib/events/buildEvent";
import { sendEmail, type EmailSendResult } from "./emailService";
import { lookupUserEmail, type LeaseWorkflowLease } from "./leaseNoticeWorkflowService";
import { LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION } from "./landlordDecisionQueue/landlordDecisionQueueLifecycleService";

export const RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION = "renewalNoticeCommunications";

type RenewalNoticeDeliveryStatus =
  | "delivery_status_unknown"
  | "not_tracked"
  | "accepted_for_sending"
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "deferred"
  | "rejected"
  | "complained"
  | "opened"
  | "clicked"
  | "unknown";

type RenewalNoticeDeliveryStatusSource =
  | "not_tracked"
  | "send_response"
  | "mailgun_webhook"
  | "mailgun_events_api"
  | "manual_reconciliation";

type SendRenewalNoticeCommunicationInput = {
  snapshotId?: unknown;
  approvalDecisionItemId?: unknown;
  confirmationAccepted?: unknown;
  recipientReviewed?: unknown;
  bodyReviewed?: unknown;
  legalServiceAcknowledged?: unknown;
  noLegalServiceClaim?: unknown;
  idempotencyKey?: unknown;
};

type SendRenewalNoticeCommunicationParams = {
  leaseId: string;
  landlordId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  lease: LeaseWorkflowLease;
  input: SendRenewalNoticeCommunicationInput;
};

type RenewalNoticeCommunicationRecord = {
  communicationId: string;
  leaseId: string;
  landlordId: string;
  tenantId: string | null;
  propertyId: string | null;
  unitId: string | null;
  snapshotId: string;
  approvalDecisionItemId: string;
  idempotencyKeyHash: string;
  subject: string;
  recipientEmail: string;
  bodyHash: string;
  status: "send_attempted" | "email_sent" | "email_failed";
  deliveryStatus: RenewalNoticeDeliveryStatus;
  deliveryStatusUpdatedAt: string | null;
  deliveryStatusSource: RenewalNoticeDeliveryStatusSource;
  deliveryStatusReason: string | null;
  deliveryEventIds: string[];
  lastProviderEventAt: string | null;
  provider: "mailgun";
  providerMessageId: string | null;
  attemptedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  tenantNotified: boolean;
  noticeServed: false;
  legalServiceEstablished: false;
  noLegalServiceClaim: true;
  confirmation: {
    confirmationAccepted: true;
    recipientReviewed: true;
    bodyReviewed: true;
    legalServiceAcknowledged: true;
    noLegalServiceClaim: true;
  };
  actor: { id: string | null; email: string | null };
  source: "renewal_notice_communication_send_api";
  createdAt: string;
  updatedAt: string;
  auditEventIds: string[];
  canonicalEventIds: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
};

type SendRenewalNoticeCommunicationResult =
  | {
      ok: true;
      idempotent?: boolean;
      communicationId: string;
      status: RenewalNoticeCommunicationRecord["status"];
      deliveryStatus: RenewalNoticeCommunicationRecord["deliveryStatus"];
      attemptedAt: string;
      sentAt: string | null;
      providerMessageId: string | null;
      auditEventId: string | null;
      timelineEventId: string | null;
      noLegalServiceClaim: true;
      noticeServed: false;
      tenantNotified: boolean;
      legalServiceEstablished: false;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      details?: string[];
      communicationId?: string;
      status?: RenewalNoticeCommunicationRecord["status"];
      deliveryStatus?: RenewalNoticeCommunicationRecord["deliveryStatus"];
      attemptedAt?: string;
      sentAt?: string | null;
      providerMessageId?: string | null;
      auditEventId?: string | null;
      timelineEventId?: string | null;
      noLegalServiceClaim?: true;
      noticeServed?: false;
      tenantNotified?: boolean;
      legalServiceEstablished?: false;
    };

function asString(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function communicationIdFor(input: {
  landlordId: string;
  leaseId: string;
  snapshotId: string;
  idempotencyKey: string;
}): string {
  return `rnc_${sha256([input.landlordId, input.leaseId, input.snapshotId, input.idempotencyKey].join(":")).slice(0, 40)}`;
}

function htmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="white-space:pre-line;font-family:Arial,sans-serif;line-height:1.5;color:#111827;">${escaped}</div>`;
}

function safeErrorMessage(error: unknown): string {
  return asString((error as any)?.message || error || "email_send_failed", 240).replace(/\bhttps?:\/\/\S+/gi, "[url]");
}

export function validateRenewalNoticeCommunicationInput(input: SendRenewalNoticeCommunicationInput): {
  ok: true;
  snapshotId: string;
  approvalDecisionItemId: string;
  idempotencyKey: string;
} | {
  ok: false;
  error: string;
  details?: string[];
} {
  const snapshotId = asString(input?.snapshotId, 240);
  const approvalDecisionItemId = asString(input?.approvalDecisionItemId, 240);
  const idempotencyKey = asString(input?.idempotencyKey, 240);
  if (!snapshotId) return { ok: false, error: "RENEWAL_NOTICE_SNAPSHOT_ID_REQUIRED", details: ["snapshotId"] };
  if (!approvalDecisionItemId) {
    return {
      ok: false,
      error: "RENEWAL_NOTICE_APPROVAL_DECISION_ITEM_ID_REQUIRED",
      details: ["approvalDecisionItemId"],
    };
  }
  if (input?.confirmationAccepted !== true) {
    return { ok: false, error: "RENEWAL_NOTICE_CONFIRMATION_ACCEPTED_REQUIRED", details: ["confirmationAccepted"] };
  }
  if (input?.recipientReviewed !== true) {
    return { ok: false, error: "RENEWAL_NOTICE_RECIPIENT_REVIEWED_REQUIRED", details: ["recipientReviewed"] };
  }
  if (input?.bodyReviewed !== true) {
    return { ok: false, error: "RENEWAL_NOTICE_BODY_REVIEWED_REQUIRED", details: ["bodyReviewed"] };
  }
  if (input?.legalServiceAcknowledged !== true) {
    return {
      ok: false,
      error: "RENEWAL_NOTICE_LEGAL_SERVICE_ACKNOWLEDGED_REQUIRED",
      details: ["legalServiceAcknowledged"],
    };
  }
  if (input?.noLegalServiceClaim !== true) {
    return { ok: false, error: "RENEWAL_NOTICE_NO_LEGAL_SERVICE_CLAIM_REQUIRED", details: ["noLegalServiceClaim"] };
  }
  if (!idempotencyKey) return { ok: false, error: "RENEWAL_NOTICE_IDEMPOTENCY_KEY_REQUIRED", details: ["idempotencyKey"] };
  return { ok: true, snapshotId, approvalDecisionItemId, idempotencyKey };
}

function toResponse(record: RenewalNoticeCommunicationRecord, idempotent = false): Extract<SendRenewalNoticeCommunicationResult, { ok: true }> {
  return {
    ok: true,
    idempotent: idempotent || undefined,
    communicationId: record.communicationId,
    status: record.status,
    deliveryStatus: record.deliveryStatus,
    attemptedAt: record.attemptedAt,
    sentAt: record.sentAt,
    providerMessageId: record.providerMessageId,
    auditEventId: record.auditEventIds[record.auditEventIds.length - 1] || null,
    timelineEventId: record.canonicalEventIds[record.canonicalEventIds.length - 1] || null,
    noLegalServiceClaim: true,
    noticeServed: false,
    tenantNotified: record.tenantNotified,
    legalServiceEstablished: false,
  };
}

function communicationSummary(record: RenewalNoticeCommunicationRecord): string {
  if (record.status === "send_attempted") {
    return "Renewal tenant communication send attempted. Not served; legal service not established.";
  }
  if (record.status === "email_sent") {
    return "Renewal tenant communication email sent. Not served; legal service not established.";
  }
  if (record.status === "email_failed") {
    return "Renewal tenant communication email failed. Tenant not notified; not served; legal service not established.";
  }
  return "Renewal tenant communication send attempted. Not served; legal service not established.";
}

function communicationEvent(input: {
  id: string;
  type:
    | "renewal_notice_send_confirmed"
    | "renewal_notice_email_send_attempted"
    | "renewal_notice_email_sent"
    | "renewal_notice_email_failed";
  status: string;
  summary: string;
  record: RenewalNoticeCommunicationRecord;
  occurredAt: string;
}) {
  return buildEvent({
    id: input.id,
    type: input.type,
    domain: "lease",
    action: input.type,
    status: input.status,
    actor: {
      type: "landlord",
      id: input.record.actor.id,
      role: "landlord",
      displayName: input.record.actor.email,
    },
    resource: {
      type: "lease",
      id: input.record.leaseId,
      parentType: input.record.propertyId ? "property" : null,
      parentId: input.record.propertyId,
    },
    occurredAt: input.occurredAt,
    visibility: "landlord",
    summary: input.summary,
    metadata: {
      landlordId: input.record.landlordId,
      leaseId: input.record.leaseId,
      tenantId: input.record.tenantId,
      propertyId: input.record.propertyId,
      unitId: input.record.unitId,
      communicationId: input.record.communicationId,
      snapshotId: input.record.snapshotId,
      approvalDecisionItemId: input.record.approvalDecisionItemId,
      deliveryStatus: input.record.deliveryStatus,
      provider: input.record.provider,
      providerMessageId: input.record.providerMessageId,
      deliveryStatusSource: input.record.deliveryStatusSource,
      deliveryStatusReason: input.record.deliveryStatusReason,
      deliveryStatusUpdatedAt: input.record.deliveryStatusUpdatedAt,
      lastProviderEventAt: input.record.lastProviderEventAt,
      noLegalServiceClaim: true,
      noticeServed: false,
      tenantNotified: input.record.tenantNotified,
      legalServiceEstablished: false,
    },
    tags: ["renewal_notice", "tenant_communication", "send_api"],
  });
}

async function writeCommunicationEvent(input: {
  record: RenewalNoticeCommunicationRecord;
  type:
    | "renewal_notice_send_confirmed"
    | "renewal_notice_email_send_attempted"
    | "renewal_notice_email_sent"
    | "renewal_notice_email_failed";
  status: string;
  occurredAt: string;
  summary?: string;
}) {
  const eventRef = db.collection("events").doc();
  const canonicalEventId = `${input.type}:${input.record.communicationId}:${input.occurredAt}`;
  const summary = input.summary || communicationSummary(input.record);
  const legacyEvent = {
    id: eventRef.id,
    landlordId: input.record.landlordId,
    actorUserId: input.record.actor.id || undefined,
    type: input.type,
    leaseId: input.record.leaseId,
    tenantId: input.record.tenantId || undefined,
    propertyId: input.record.propertyId || undefined,
    payload: {
      communicationId: input.record.communicationId,
      snapshotId: input.record.snapshotId,
      approvalDecisionItemId: input.record.approvalDecisionItemId,
      status: input.record.status,
      deliveryStatus: input.record.deliveryStatus,
      provider: input.record.provider,
      providerMessageId: input.record.providerMessageId,
      deliveryStatusSource: input.record.deliveryStatusSource,
      deliveryStatusReason: input.record.deliveryStatusReason,
      deliveryStatusUpdatedAt: input.record.deliveryStatusUpdatedAt,
      lastProviderEventAt: input.record.lastProviderEventAt,
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
  const canonicalEvent = communicationEvent({
    id: canonicalEventId,
    type: input.type,
    status: input.status,
    summary,
    record: input.record,
    occurredAt: input.occurredAt,
  });
  const batch = db.batch();
  batch.set(eventRef, legacyEvent);
  batch.set(db.collection(CANONICAL_EVENTS_COLLECTION).doc(canonicalEvent.id), canonicalEvent);
  await batch.commit();
  return { auditEventId: eventRef.id, canonicalEventId };
}

function approvalSnapshotId(decision: any): string {
  return (
    asString(decision?.metadata?.draftSnapshotId, 240) ||
    asString(decision?.sourceSnapshot?.draftSnapshotId, 240) ||
    asString(decision?.sourceSnapshot?.snapshotId, 240)
  );
}

export async function sendRenewalNoticeCommunication(
  params: SendRenewalNoticeCommunicationParams
): Promise<SendRenewalNoticeCommunicationResult> {
  const leaseId = asString(params.leaseId, 240);
  const landlordId = asString(params.landlordId, 240);
  if (!leaseId || !landlordId) return { ok: false, statusCode: 401, error: "UNAUTHORIZED" };

  const confirmation = validateRenewalNoticeCommunicationInput(params.input);
  if (!confirmation.ok) {
    return { ok: false, statusCode: 400, error: confirmation.error, details: confirmation.details };
  }

  const communicationId = communicationIdFor({
    landlordId,
    leaseId,
    snapshotId: confirmation.snapshotId,
    idempotencyKey: confirmation.idempotencyKey,
  });
  const communicationRef = db.collection(RENEWAL_NOTICE_COMMUNICATIONS_COLLECTION).doc(communicationId);
  const existingCommunication = await communicationRef.get();
  if (existingCommunication.exists) {
    const existing = existingCommunication.data() as RenewalNoticeCommunicationRecord;
    if (existing.status === "email_failed") {
      return {
        ok: false,
        statusCode: 502,
        error: "RENEWAL_NOTICE_EMAIL_SEND_FAILED",
        communicationId: existing.communicationId,
        status: existing.status,
        deliveryStatus: existing.deliveryStatus,
        attemptedAt: existing.attemptedAt,
        sentAt: null,
        providerMessageId: existing.providerMessageId || null,
        auditEventId: existing.auditEventIds[existing.auditEventIds.length - 1] || null,
        timelineEventId: existing.canonicalEventIds[existing.canonicalEventIds.length - 1] || null,
        noLegalServiceClaim: true,
        noticeServed: false,
        tenantNotified: false,
        legalServiceEstablished: false,
      };
    }
    return toResponse(existing, true);
  }

  const snapshotSnap = await db.collection("renewalNoticeDraftSnapshots").doc(confirmation.snapshotId).get();
  if (!snapshotSnap.exists) return { ok: false, statusCode: 404, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_NOT_FOUND" };
  const snapshot = snapshotSnap.data() as any;
  if (asString(snapshot?.landlordId, 240) !== landlordId || asString(snapshot?.leaseId, 240) !== leaseId) {
    return { ok: false, statusCode: 403, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_SCOPE_MISMATCH" };
  }
  if (asString(snapshot?.status, 80) !== "draft_saved" || !asString(snapshot?.generatedDraftText, 20_000)) {
    return { ok: false, statusCode: 400, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_NOT_SEND_READY" };
  }
  if (snapshot?.emailSent === true || snapshot?.noticeServed === true || snapshot?.tenantNotified === true) {
    return { ok: false, statusCode: 400, error: "RENEWAL_NOTICE_DRAFT_SNAPSHOT_DELIVERY_STATE_INVALID" };
  }

  const decisionSnap = await db.collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION).doc(confirmation.approvalDecisionItemId).get();
  if (!decisionSnap.exists) return { ok: false, statusCode: 404, error: "RENEWAL_NOTICE_APPROVAL_DECISION_NOT_FOUND" };
  const decision = { id: decisionSnap.id, ...((decisionSnap.data() as any) || {}) };
  if (asString(decision.landlordId, 240) !== landlordId || asString(decision.leaseId, 240) !== leaseId) {
    return { ok: false, statusCode: 403, error: "RENEWAL_NOTICE_APPROVAL_DECISION_SCOPE_MISMATCH" };
  }
  if (asString(decision.sourceType, 120) !== "renewal_notice_send_review") {
    return { ok: false, statusCode: 400, error: "RENEWAL_NOTICE_APPROVAL_DECISION_SOURCE_TYPE_INVALID" };
  }
  if (asString(decision.status, 80) !== "approved") {
    return { ok: false, statusCode: 409, error: "RENEWAL_NOTICE_APPROVAL_DECISION_NOT_APPROVED" };
  }
  if (approvalSnapshotId(decision) !== confirmation.snapshotId) {
    return { ok: false, statusCode: 409, error: "RENEWAL_NOTICE_APPROVAL_SNAPSHOT_MISMATCH" };
  }

  const tenantEmail = await lookupUserEmail(params.lease.tenantId, ["tenants", "users"]);
  if (!tenantEmail) return { ok: false, statusCode: 400, error: "RENEWAL_NOTICE_TENANT_EMAIL_REQUIRED" };

  const nowIso = new Date().toISOString();
  const actorId = asString(params.actorId, 240) || null;
  const actorEmail = asString(params.actorEmail, 320) || null;
  const body = asString(snapshot.generatedDraftText, 20_000);
  const subjectContext = asString(snapshot.propertyUnitLabel || params.lease.propertyLabel || params.lease.propertyAddress, 120);
  const subject = subjectContext ? `Renewal details for ${subjectContext}` : "Renewal details for your lease";
  const attemptedRecord: RenewalNoticeCommunicationRecord = {
    communicationId,
    leaseId,
    landlordId,
    tenantId: params.lease.tenantId || snapshot.tenantId || null,
    propertyId: params.lease.propertyId || snapshot.propertyId || null,
    unitId: params.lease.unitId || snapshot.unitId || null,
    snapshotId: confirmation.snapshotId,
    approvalDecisionItemId: confirmation.approvalDecisionItemId,
    idempotencyKeyHash: sha256(confirmation.idempotencyKey),
    subject,
    recipientEmail: tenantEmail,
    bodyHash: sha256(body),
    status: "send_attempted",
    deliveryStatus: "delivery_status_unknown",
    deliveryStatusUpdatedAt: null,
    deliveryStatusSource: "not_tracked",
    deliveryStatusReason: null,
    deliveryEventIds: [],
    lastProviderEventAt: null,
    provider: "mailgun",
    providerMessageId: null,
    attemptedAt: nowIso,
    sentAt: null,
    failedAt: null,
    tenantNotified: false,
    noticeServed: false,
    legalServiceEstablished: false,
    noLegalServiceClaim: true,
    confirmation: {
      confirmationAccepted: true,
      recipientReviewed: true,
      bodyReviewed: true,
      legalServiceAcknowledged: true,
      noLegalServiceClaim: true,
    },
    actor: { id: actorId, email: actorEmail },
    source: "renewal_notice_communication_send_api",
    createdAt: nowIso,
    updatedAt: nowIso,
    auditEventIds: [],
    canonicalEventIds: [],
  };

  const confirmedEvent = await writeCommunicationEvent({
    record: attemptedRecord,
    type: "renewal_notice_send_confirmed",
    status: "completed",
    occurredAt: nowIso,
    summary: "Renewal tenant communication send confirmed internally. Not served; legal service not established.",
  });
  const attemptedEvent = await writeCommunicationEvent({
    record: attemptedRecord,
    type: "renewal_notice_email_send_attempted",
    status: "attempted",
    occurredAt: nowIso,
  });
  const attemptedWithAudit = {
    ...attemptedRecord,
    auditEventIds: [confirmedEvent.auditEventId, attemptedEvent.auditEventId],
    canonicalEventIds: [confirmedEvent.canonicalEventId, attemptedEvent.canonicalEventId],
  };
  await communicationRef.set(attemptedWithAudit, { merge: false });

  try {
    const emailResult = (await sendEmail({
      to: tenantEmail,
      subject,
      text: body,
      html: htmlFromText(body),
    })) as EmailSendResult | undefined;
    const sentAt = new Date().toISOString();
    const sentRecord: RenewalNoticeCommunicationRecord = {
      ...attemptedWithAudit,
      status: "email_sent",
      deliveryStatus: "accepted_for_sending",
      deliveryStatusUpdatedAt: sentAt,
      deliveryStatusSource: "send_response",
      deliveryStatusReason: "mailgun_accepted",
      lastProviderEventAt: sentAt,
      providerMessageId: emailResult?.providerMessageId || null,
      sentAt,
      tenantNotified: true,
      updatedAt: sentAt,
    };
    const sentEvent = await writeCommunicationEvent({
      record: sentRecord,
      type: "renewal_notice_email_sent",
      status: "completed",
      occurredAt: sentAt,
    });
    const finalRecord = {
      ...sentRecord,
      auditEventIds: [...sentRecord.auditEventIds, sentEvent.auditEventId],
      canonicalEventIds: [...sentRecord.canonicalEventIds, sentEvent.canonicalEventId],
    };
    await communicationRef.set(finalRecord, { merge: true });
    return toResponse(finalRecord);
  } catch (err: any) {
    const failedAt = new Date().toISOString();
    const failedRecord: RenewalNoticeCommunicationRecord = {
      ...attemptedWithAudit,
      status: "email_failed",
      deliveryStatus: "failed",
      deliveryStatusUpdatedAt: failedAt,
      deliveryStatusSource: "send_response",
      deliveryStatusReason: safeErrorMessage(err),
      lastProviderEventAt: failedAt,
      failedAt,
      updatedAt: failedAt,
      errorCode: "EMAIL_SEND_FAILED",
      errorMessage: safeErrorMessage(err),
    };
    const failedEvent = await writeCommunicationEvent({
      record: failedRecord,
      type: "renewal_notice_email_failed",
      status: "failed",
      occurredAt: failedAt,
    });
    const finalRecord = {
      ...failedRecord,
      auditEventIds: [...failedRecord.auditEventIds, failedEvent.auditEventId],
      canonicalEventIds: [...failedRecord.canonicalEventIds, failedEvent.canonicalEventId],
    };
    await communicationRef.set(finalRecord, { merge: true });
    return {
      ok: false,
      statusCode: 502,
      error: "RENEWAL_NOTICE_EMAIL_SEND_FAILED",
      communicationId: finalRecord.communicationId,
      status: finalRecord.status,
      deliveryStatus: finalRecord.deliveryStatus,
      attemptedAt: finalRecord.attemptedAt,
      sentAt: null,
      providerMessageId: finalRecord.providerMessageId || null,
      auditEventId: failedEvent.auditEventId,
      timelineEventId: failedEvent.canonicalEventId,
      noLegalServiceClaim: true,
      noticeServed: false,
      tenantNotified: false,
      legalServiceEstablished: false,
    };
  }
}
