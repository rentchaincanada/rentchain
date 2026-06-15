import { createHash } from "crypto";
import { db, FieldValue } from "../../firebase";
import { getSignedDownloadUrl } from "../../lib/gcsSignedUrl";
import { uploadBufferToGcs } from "../../lib/gcs";
import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import { deriveLeaseSigningState, type DerivedLeaseSigningState } from "../leaseStateHelper";
import { getConfiguredSigningProvider, signingProviderRegistry } from "./providers";
import type { ISigningProvider, SigningProviderEventType } from "./providers/types";

export type LeaseSigningStatus =
  | "not_started"
  | "pending_signature"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "failed";

export type LeaseSigningEvent = {
  id: string;
  type: SigningProviderEventType;
  occurredAt: string;
  actorRole: "landlord" | "tenant" | "provider" | "system";
  signerEmailHash?: string | null;
  providerDispatchMode?: string | null;
  providerDispatchStatus?: string | null;
  providerDispatchMessage?: string | null;
  providerTestMode?: boolean | null;
};

export type LeaseSigningSnapshot = {
  signingStatus: LeaseSigningStatus;
  derivedLeaseState: DerivedLeaseSigningState;
  signingProviderId: string | null;
  signingRequestId: string | null;
  providerRequestRef: string | null;
  providerDispatchMode: string | null;
  providerDispatchStatus: string | null;
  providerDispatchMessage: string | null;
  sentAt: string | null;
  signedAt: string | null;
  documentUrl: string | null;
  events: LeaseSigningEvent[];
};

const REQUESTS = "leaseSigningRequests";
const EVENTS = "leaseSigningEvents";
const DEAD_LETTERS = "leaseSigningWebhookDeadLetters";
let lastGeneratedTimestampMs = 0;

function nowIso() {
  const current = Date.now();
  const next = current <= lastGeneratedTimestampMs ? lastGeneratedTimestampMs + 1 : current;
  lastGeneratedTimestampMs = next;
  return new Date(next).toISOString();
}

function digest(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function emailHash(value: unknown) {
  const email = normalizeEmail(value);
  return email ? digest(`email:${email}`, 24) : null;
}

function safeProviderRef(providerId: string, providerRequestId: string) {
  return `${providerId}_ref_${digest(`${providerId}:${providerRequestId}`, 24)}`;
}

function requestIdFor(landlordId: string, leaseId: string, providerId: string) {
  return `lsr_${digest(`${landlordId}:${leaseId}:${providerId}`, 24)}`;
}

function eventIdFor(requestId: string, type: string, occurredAt: string, eventRef = "") {
  return `lse_${digest(`${requestId}:${type}:${occurredAt}:${eventRef}`, 28)}`;
}

function asDateMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromEvents(events: LeaseSigningEvent[]): LeaseSigningStatus {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const type = events[index]?.type;
    if (type === "signed") return "signed";
    if (type === "cancelled") return "cancelled";
    if (type === "failed") return "failed";
    if (type === "rejected") return "rejected";
    if (type === "expired") return "expired";
    if (type === "sent" || type === "viewed") return "pending_signature";
  }
  return "not_started";
}

function statusFromEventType(type: SigningProviderEventType): LeaseSigningStatus | null {
  if (type === "signed") return "signed";
  if (type === "cancelled") return "cancelled";
  if (type === "failed") return "failed";
  if (type === "rejected") return "rejected";
  if (type === "expired") return "expired";
  if (type === "sent" || type === "viewed") return "pending_signature";
  return null;
}

function normalizeStoredStatus(value: unknown): LeaseSigningStatus | null {
  const status = String(value || "").trim();
  if (
    status === "not_started" ||
    status === "pending_signature" ||
    status === "signed" ||
    status === "rejected" ||
    status === "expired" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return status;
  }
  return null;
}

function projectEvent(doc: any): LeaseSigningEvent {
  const data = (doc?.data?.() || {}) as any;
  return {
    id: String(doc?.id || data?.id || ""),
    type: data?.type,
    occurredAt: String(data?.occurredAt || ""),
    actorRole: data?.actorRole || "system",
    signerEmailHash: data?.signerEmailHash || null,
    providerDispatchMode: data?.providerDispatchMode || null,
    providerDispatchStatus: data?.providerDispatchStatus || null,
    providerDispatchMessage: data?.providerDispatchMessage || null,
    providerTestMode: data?.providerTestMode === true ? true : data?.providerTestMode === false ? false : null,
  };
}

async function loadEvents(requestId: string): Promise<LeaseSigningEvent[]> {
  const snap = await db.collection(EVENTS).where("requestId", "==", requestId).get();
  return (snap.docs || [])
    .map(projectEvent)
    .filter((event) => event.id && event.type && event.occurredAt)
    .sort((a, b) => asDateMillis(a.occurredAt) - asDateMillis(b.occurredAt));
}

async function appendSigningEvent(input: {
  requestId: string;
  leaseId: string;
  landlordId: string;
  providerId: string;
  providerRequestId: string;
  type: SigningProviderEventType;
  occurredAt?: string;
  actorRole: "landlord" | "tenant" | "provider" | "system";
  signerEmail?: string | null;
  providerEventId?: string | null;
  providerDispatchMode?: string | null;
  providerDispatchStatus?: string | null;
  providerDispatchMessage?: string | null;
  providerTestMode?: boolean | null;
}) {
  const occurredAt = input.occurredAt || nowIso();
  const id = eventIdFor(input.requestId, input.type, occurredAt, input.providerEventId || "");
  const ref = db.collection(EVENTS).doc(id);
  const existing = await ref.get();
  if (existing.exists) return id;
  await ref.set({
    requestId: input.requestId,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    providerId: input.providerId,
    providerRequestRef: safeProviderRef(input.providerId, input.providerRequestId),
    providerEventRef: input.providerEventId ? `${input.providerId}_evt_${digest(input.providerEventId, 18)}` : null,
    type: input.type,
    actorRole: input.actorRole,
    signerEmailHash: emailHash(input.signerEmail),
    providerDispatchMode: input.providerDispatchMode || null,
    providerDispatchStatus: input.providerDispatchStatus || null,
    providerDispatchMessage: input.providerDispatchMessage || null,
    providerTestMode: input.providerTestMode ?? null,
    occurredAt,
    createdAt: FieldValue.serverTimestamp(),
    rawIdsIncluded: false,
    payloadIncluded: false,
  });
  const currentSigningStatus = statusFromEventType(input.type);
  if (currentSigningStatus) {
    await db.collection(REQUESTS).doc(input.requestId).set(
      {
        currentSigningStatus,
        currentStatusAt: occurredAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await writeCanonicalEvent({
    domain: "lease",
    action: `signing_${input.type}`,
    status: input.type,
    actor: {
      type: input.actorRole === "provider" ? "system" : input.actorRole,
      role: input.actorRole,
      id: input.actorRole,
    },
    resource: { type: "lease", id: input.leaseId },
    occurredAt,
    visibility: "internal",
    summary: "Lease signing event recorded",
    metadata: {
      requestRef: input.requestId,
      providerRef: safeProviderRef(input.providerId, input.providerRequestId),
      providerDispatchMode: input.providerDispatchMode || null,
      providerDispatchStatus: input.providerDispatchStatus || null,
      providerTestMode: input.providerTestMode ?? null,
    },
  }).catch(() => undefined);
  return id;
}

async function loadLatestRequest(leaseId: string, landlordId?: string | null) {
  const snap = await db.collection(REQUESTS).where("leaseId", "==", leaseId).get();
  const docs = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, data: (doc.data() as any) || {} }))
    .filter((entry) => !landlordId || String(entry.data?.landlordId || "") === landlordId)
    .sort((a, b) => asDateMillis(b.data?.createdAt || b.data?.sentAt) - asDateMillis(a.data?.createdAt || a.data?.sentAt));
  return docs[0] || null;
}

export async function loadLeaseSigningSnapshot(input: {
  leaseId: string;
  landlordId?: string | null;
  lease?: Record<string, unknown> | null;
}): Promise<LeaseSigningSnapshot> {
  const request = await loadLatestRequest(input.leaseId, input.landlordId || null);
  if (!request) {
    return {
      signingStatus: "not_started",
      derivedLeaseState: deriveLeaseSigningState({ lease: input.lease || {}, signingStatus: "not_started" }),
      signingProviderId: null,
      signingRequestId: null,
      providerRequestRef: null,
      providerDispatchMode: null,
      providerDispatchStatus: null,
      providerDispatchMessage: null,
      sentAt: null,
      signedAt: null,
      documentUrl: null,
      events: [],
    };
  }
  const events = await loadEvents(request.id);
  const signingStatus = normalizeStoredStatus(request.data?.currentSigningStatus) || statusFromEvents(events);
  const signedAt = events.find((event) => event.type === "signed")?.occurredAt || null;
  const sentAt = [...events].reverse().find((event) => event.type === "sent")?.occurredAt || String(request.data?.sentAt || "") || null;
  const providerId = String(request.data?.providerId || "");
  const providerDispatchMode = String(request.data?.providerDispatchMode || (providerId === "mock" ? "mock" : "")).trim() || null;
  const providerDispatchStatus = String(request.data?.providerDispatchStatus || (providerId === "mock" ? "mocked_no_email" : "")).trim() || null;
  return {
    signingStatus,
    derivedLeaseState: deriveLeaseSigningState({ lease: input.lease || {}, signingStatus }),
    signingProviderId: providerId,
    signingRequestId: request.id,
    providerRequestRef: String(request.data?.providerRequestRef || ""),
    providerDispatchMode,
    providerDispatchStatus,
    providerDispatchMessage: String(request.data?.providerDispatchMessage || (providerId === "mock" ? "Mock signing provider recorded the request without sending email." : "")).trim() || null,
    sentAt,
    signedAt,
    documentUrl: String(request.data?.signedDocumentUrl || request.data?.documentUrl || "") || null,
    events,
  };
}

export async function sendLeaseForSignature(input: {
  leaseId: string;
  lease: Record<string, any>;
  landlordId: string;
  tenantEmails: string[];
  message?: string | null;
}) {
  const provider = getConfiguredSigningProvider();
  if (!provider?.isConfigured()) throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  const current = await loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
  if (current.signingStatus === "signed") throw Object.assign(new Error("signing_already_complete"), { status: 400 });
  if (current.signingStatus === "pending_signature") throw Object.assign(new Error("signing_already_pending"), { status: 400 });
  const emails = input.tenantEmails.map(normalizeEmail).filter(Boolean);
  if (!emails.length || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw Object.assign(new Error("invalid_tenant_email"), { status: 400 });
  }

  const documentUrl = String(input.lease?.documentUrl || input.lease?.approvedDocumentUrl || input.lease?.documentRef || "").trim();
  const sent = await provider.sendForSignature({
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    documentUrl,
    title: "Lease signature request",
    message: input.message || null,
    signers: emails.map((email) => ({ email, role: "tenant" as const })),
    callbackUrl: process.env.SIGNING_PROVIDER_CALLBACK_URL || process.env.SIGNING_CALLBACK_URL || null,
  });
  const providerId = provider.getProviderId();
  const requestId = requestIdFor(input.landlordId, input.leaseId, providerId);
  const now = nowIso();
  const requestRef = db.collection(REQUESTS).doc(requestId);
  const existing = await requestRef.get();
  await requestRef.set(
    {
      leaseId: input.leaseId,
      landlordId: input.landlordId,
      providerId,
      providerRequestRef: safeProviderRef(providerId, sent.providerRequestId),
      providerRequestId: sent.providerRequestId,
      tenantEmailHashes: emails.map(emailHash),
      documentUrl,
      expiresAt: sent.expiresAt || null,
      providerDispatchMode: sent.dispatchMode || null,
      providerDispatchStatus: sent.dispatchStatus || null,
      providerDispatchMessage: sent.dispatchMessage || null,
      providerTestMode: sent.providerTestMode ?? null,
      sentAt: now,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    { merge: true }
  );
  await appendSigningEvent({
    requestId,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    providerId,
    providerRequestId: sent.providerRequestId,
    type: "sent",
    occurredAt: now,
    actorRole: "landlord",
    providerDispatchMode: sent.dispatchMode || null,
    providerDispatchStatus: sent.dispatchStatus || null,
    providerDispatchMessage: sent.dispatchMessage || null,
    providerTestMode: sent.providerTestMode ?? null,
  });
  return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
}

export async function getTenantSigningUrl(input: {
  leaseId: string;
  lease: Record<string, any>;
  tenantEmail?: string | null;
  tenantId: string;
}) {
  const request = await loadLatestRequest(input.leaseId, String(input.lease?.landlordId || ""));
  if (!request) throw Object.assign(new Error("signing_not_started"), { status: 400 });
  const events = await loadEvents(request.id);
  if (statusFromEvents(events) !== "pending_signature") {
    throw Object.assign(new Error("signing_not_available"), { status: 400 });
  }
  const provider = signingProviderRegistry.getProvider(String(request.data?.providerId || ""));
  if (!provider?.isConfigured()) throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  const url = await provider.getSigningUrl({
    providerRequestId: String(request.data?.providerRequestId || ""),
    signerEmail: input.tenantEmail || null,
    redirectUrl: `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/tenant/lease`,
  });
  await appendSigningEvent({
    requestId: request.id,
    leaseId: input.leaseId,
    landlordId: String(input.lease?.landlordId || ""),
    providerId: provider.getProviderId(),
    providerRequestId: String(request.data?.providerRequestId || ""),
    type: "viewed",
    actorRole: "tenant",
    signerEmail: input.tenantEmail || null,
  });
  return { signingUrl: url, signingProviderId: provider.getProviderId() };
}

export async function cancelLeaseSigning(input: { leaseId: string; lease: Record<string, any>; landlordId: string }) {
  const request = await loadLatestRequest(input.leaseId, input.landlordId);
  if (!request) throw Object.assign(new Error("signing_not_started"), { status: 404 });
  const events = await loadEvents(request.id);
  if (statusFromEvents(events) !== "pending_signature") throw Object.assign(new Error("signing_not_pending"), { status: 400 });
  const provider = signingProviderRegistry.getProvider(String(request.data?.providerId || ""));
  if (provider?.isConfigured()) await provider.cancelRequest(String(request.data?.providerRequestId || ""));
  await appendSigningEvent({
    requestId: request.id,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    providerId: String(request.data?.providerId || "mock"),
    providerRequestId: String(request.data?.providerRequestId || ""),
    type: "cancelled",
    actorRole: "landlord",
  });
  return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
}

export async function downloadSignedLease(input: { leaseId: string; lease: Record<string, any>; landlordId: string }) {
  const request = await loadLatestRequest(input.leaseId, input.landlordId);
  if (!request) throw Object.assign(new Error("lease_not_found"), { status: 404 });
  const events = await loadEvents(request.id);
  if (statusFromEvents(events) !== "signed") throw Object.assign(new Error("signed_document_not_found"), { status: 404 });
  if (request.data?.signedDocumentUrl) return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
  const provider = signingProviderRegistry.getProvider(String(request.data?.providerId || ""));
  if (!provider?.isConfigured()) throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  const doc = await provider.downloadSignedDocument(String(request.data?.providerRequestId || ""));
  if (!doc) throw Object.assign(new Error("signed_document_not_found"), { status: 404 });
  const storagePath = `lease-signing/${digest(input.landlordId, 12)}/${request.id}/${doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const uploaded = await uploadBufferToGcs({
    path: storagePath,
    contentType: doc.contentType,
    buffer: doc.buffer,
    metadata: { leaseSigningRequestId: request.id },
  });
  const documentUrl = await getSignedDownloadUrl({ bucket: uploaded.bucket, path: uploaded.path, expiresMinutes: 30 });
  await db.collection(REQUESTS).doc(request.id).set(
    {
      signedDocumentUrl: documentUrl,
      signedDocumentHash: createHash("sha256").update(doc.buffer).digest("hex"),
      signedDocumentStoredAt: nowIso(),
    },
    { merge: true }
  );
  await appendSigningEvent({
    requestId: request.id,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    providerId: provider.getProviderId(),
    providerRequestId: String(request.data?.providerRequestId || ""),
    type: "downloaded",
    actorRole: "landlord",
  });
  return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
}

export async function processSigningWebhook(input: { providerId: string; headers: any; body: any; rawBody?: Buffer }) {
  const provider = signingProviderRegistry.getProvider(input.providerId);
  if (!provider?.isConfigured()) {
    await db.collection(DEAD_LETTERS).doc(`dl_${digest(`${input.providerId}:${Date.now()}`, 24)}`).set({
      providerId: input.providerId,
      status: "provider_not_configured",
      createdAt: FieldValue.serverTimestamp(),
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  }
  const rawBody = input.rawBody || (Buffer.isBuffer(input.body) ? input.body : undefined);
  const verified = await provider.verifyWebhookSignature({ ...input, rawBody });
  if (!verified) throw Object.assign(new Error("webhook_validation_failed"), { status: 400 });
  let parsed;
  try {
    parsed = await provider.parseWebhookPayload(input.body);
  } catch (error) {
    await db.collection(DEAD_LETTERS).doc(`dl_${digest(`${input.providerId}:${Date.now()}`, 24)}`).set({
      providerId: input.providerId,
      status: "payload_parse_failed",
      createdAt: FieldValue.serverTimestamp(),
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    throw error;
  }
  const requestSnap = await db.collection(REQUESTS).where("providerRequestRef", "==", safeProviderRef(provider.getProviderId(), parsed.providerRequestId)).limit(1).get();
  const requestDoc = requestSnap.docs?.[0];
  if (!requestDoc) throw Object.assign(new Error("lease_not_found"), { status: 404 });
  const data = requestDoc.data() as any;
  await appendSigningEvent({
    requestId: requestDoc.id,
    leaseId: String(data?.leaseId || ""),
    landlordId: String(data?.landlordId || ""),
    providerId: provider.getProviderId(),
    providerRequestId: parsed.providerRequestId,
    providerEventId: parsed.providerEventId,
    type: parsed.type,
    actorRole: "provider",
    signerEmail: parsed.signerEmail || null,
    occurredAt: parsed.occurredAt,
  });
}

export function signingErrorStatus(error: any) {
  return Number(error?.status || 500);
}

export function signingErrorCode(error: any) {
  const code = String(error?.message || "lease_signing_failed");
  return code.includes(" ") ? "lease_signing_failed" : code;
}
