import { createHash } from "crypto";
import { db, FieldValue } from "../../firebase";
import { getSignedDownloadUrl } from "../../lib/gcsSignedUrl";
import { uploadBufferToGcs } from "../../lib/gcs";
import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import { deriveLeaseSigningState, type DerivedLeaseSigningState } from "../leaseStateHelper";
import { getConfiguredSigningProvider, signingProviderRegistry } from "./providers";
import type { ISigningProvider, SigningProviderEventType, SigningProviderFieldPlacement } from "./providers/types";

export type LeaseSigningStatus =
  | "not_started"
  | "pending_signature"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "failed"
  | "ambiguous_terminal_state";

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

export type SignedDocumentState = "available" | "pending_persistence" | "persistence_failed" | "unavailable" | "not_expected";
export type SignedDocumentRecoveryAction = "none" | "retry_download" | "admin_review";

export type LeaseSigningDocumentProjection = {
  signingLifecycleState: LeaseSigningStatus;
  executionState: DerivedLeaseSigningState;
  hasEverBeenSigned: boolean;
  signedDocumentState: SignedDocumentState;
  signedDocumentAvailable: boolean;
  signedDocumentRecoveryAction: SignedDocumentRecoveryAction;
  reminderEligible: boolean;
  viewSignedDocumentAllowed: boolean;
};

export type LeaseSigningSnapshot = LeaseSigningDocumentProjection & {
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
  currentStatusAt: string | null;
  documentUrl: string | null;
  signedDocumentHash: string | null;
  signedDocumentStoredAt: string | null;
  signedDocumentSource: "signedDocument" | "legacySignedDocumentUrl" | null;
  events: LeaseSigningEvent[];
};

export type SignedLeaseDocumentDownload = {
  documentUrl: string | null;
  expiresInSeconds: number | null;
  documentHash: string | null;
  signedDocumentStoredAt: string | null;
  source: "signedDocument" | "legacySignedDocumentUrl" | null;
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

function signingReturnUrl() {
  const explicit = String(process.env.SIGNING_PROVIDER_RETURN_URL || process.env.SIGNING_RETURN_URL || "").trim();
  if (explicit) return explicit;
  const appBaseUrl = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  return appBaseUrl ? `${appBaseUrl}/signing/complete` : null;
}

function emailHash(value: unknown) {
  const email = normalizeEmail(value);
  return email ? digest(`email:${email}`, 24) : null;
}

function safeProviderRef(providerId: string, providerRequestId: string) {
  return `${providerId}_ref_${digest(`${providerId}:${providerRequestId}`, 24)}`;
}

function safeDocumentMetadataFromRequest(data: any) {
  return {
    documentId: String(data?.documentId || "") || null,
    documentHash: String(data?.documentHash || "") || null,
    manifestHash: String(data?.manifestHash || "") || null,
    templateVersion: String(data?.templateVersion || "") || null,
    jurisdictionCode: String(data?.jurisdictionCode || "") || null,
  };
}

function safeProviderMetadataFromRequest(data: any) {
  return {
    providerDispatchMode: String(data?.providerDispatchMode || "") || null,
    providerDispatchStatus: String(data?.providerDispatchStatus || "") || null,
    providerDispatchMessage: String(data?.providerDispatchMessage || "") || null,
    providerTestMode: data?.providerTestMode === true ? true : data?.providerTestMode === false ? false : null,
  };
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

function parseGcsUrlStorageRef(value: unknown): { bucket: string; path: string; source: "legacySignedDocumentUrl" } | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname === "storage.googleapis.com") {
      const [bucket, ...pathParts] = parsed.pathname.replace(/^\/+/, "").split("/");
      const path = pathParts.join("/");
      const decodedPath = decodeURIComponent(path);
      if (bucket && /^lease-signing\/.+\.pdf$/i.test(decodedPath)) return { bucket, path: decodedPath, source: "legacySignedDocumentUrl" };
    }
    if (parsed.hostname.endsWith(".storage.googleapis.com")) {
      const bucket = parsed.hostname.replace(/\.storage\.googleapis\.com$/, "");
      const path = parsed.pathname.replace(/^\/+/, "");
      const decodedPath = decodeURIComponent(path);
      if (bucket && /^lease-signing\/.+\.pdf$/i.test(decodedPath)) return { bucket, path: decodedPath, source: "legacySignedDocumentUrl" };
    }
  } catch {
    return null;
  }
  return null;
}

function signedDocumentStorageRefFromRequest(data: any): { bucket: string; path: string; source: "signedDocument" | "legacySignedDocumentUrl" } | null {
  const signedDocument = data?.signedDocument || {};
  const bucket = String(signedDocument.bucket || signedDocument.storageBucket || "").trim();
  const path = String(signedDocument.path || signedDocument.storagePath || signedDocument.objectKey || "").trim();
  if (bucket && path) return { bucket, path, source: "signedDocument" };
  return parseGcsUrlStorageRef(data?.signedDocumentUrl);
}

function collapseEventsForProjection(events: LeaseSigningEvent[]) {
  let latestSigned: LeaseSigningEvent | null = null;
  for (const event of events) {
    if (event.type === "signed") latestSigned = event;
  }
  return events.filter((event) => event.type !== "signed").concat(latestSigned ? [latestSigned] : []).sort((a, b) => asDateMillis(a.occurredAt) - asDateMillis(b.occurredAt));
}

function compareEvents(a: LeaseSigningEvent, b: LeaseSigningEvent) {
  const timeDelta = asDateMillis(a.occurredAt) - asDateMillis(b.occurredAt);
  return timeDelta || a.id.localeCompare(b.id);
}

function lifecycleStatusForEvent(type: SigningProviderEventType): LeaseSigningStatus | null {
  if (type === "sent" || type === "viewed") return "pending_signature";
  if (type === "signed" || type === "cancelled" || type === "expired" || type === "rejected" || type === "failed") return type;
  return null;
}

async function signedDocumentDownloadFromRequest(data: any): Promise<SignedLeaseDocumentDownload> {
  const ref = signedDocumentStorageRefFromRequest(data);
  if (!ref) {
    return {
      documentUrl: null,
      expiresInSeconds: null,
      documentHash: String(data?.signedDocumentHash || "") || null,
      signedDocumentStoredAt: String(data?.signedDocumentStoredAt || "") || null,
      source: null,
    };
  }
  const expiresMinutes = 30;
  const documentUrl = await getSignedDownloadUrl({ bucket: ref.bucket, path: ref.path, expiresMinutes });
  return {
    documentUrl,
    expiresInSeconds: expiresMinutes * 60,
    documentHash: String(data?.signedDocumentHash || "") || null,
    signedDocumentStoredAt: String(data?.signedDocumentStoredAt || "") || null,
    source: ref.source,
  };
}

function statusFromEvents(events: LeaseSigningEvent[]): LeaseSigningStatus {
  const lifecycleEvents = events
    .map((event) => ({ event, status: lifecycleStatusForEvent(event.type) }))
    .filter((entry): entry is { event: LeaseSigningEvent; status: LeaseSigningStatus } => Boolean(entry.status));
  if (!lifecycleEvents.length) return "not_started";
  const latestTime = Math.max(...lifecycleEvents.map(({ event }) => asDateMillis(event.occurredAt)));
  const latestStatuses = new Set(
    lifecycleEvents.filter(({ event }) => asDateMillis(event.occurredAt) === latestTime).map(({ status }) => status)
  );
  const terminalStatuses = [...latestStatuses].filter((status) => status !== "pending_signature");
  if (!terminalStatuses.length) return "pending_signature";
  if (new Set(terminalStatuses).size === 1) return terminalStatuses[0];
  return "ambiguous_terminal_state";
}

function buildSigningDocumentProjection(input: {
  signingStatus: LeaseSigningStatus;
  derivedLeaseState: DerivedLeaseSigningState;
  events: LeaseSigningEvent[];
  requestData?: any;
}): LeaseSigningDocumentProjection {
  const hasEverBeenSigned = input.events.some((event) => event.type === "signed");
  const hasDurableDocument = Boolean(signedDocumentStorageRefFromRequest(input.requestData));
  const persistenceStatus = String(input.requestData?.signedDocumentPersistenceStatus || "").trim();
  let signedDocumentState: SignedDocumentState = "not_expected";
  let signedDocumentRecoveryAction: SignedDocumentRecoveryAction = "none";
  if (hasDurableDocument) {
    signedDocumentState = "available";
  } else if (hasEverBeenSigned) {
    signedDocumentState = persistenceStatus === "failed" ? "persistence_failed" : input.signingStatus === "signed" ? "pending_persistence" : "unavailable";
    signedDocumentRecoveryAction = input.signingStatus === "signed" ? "retry_download" : "admin_review";
  }
  return {
    signingLifecycleState: input.signingStatus,
    executionState: input.derivedLeaseState,
    hasEverBeenSigned,
    signedDocumentState,
    signedDocumentAvailable: hasDurableDocument,
    signedDocumentRecoveryAction,
    reminderEligible: input.signingStatus === "pending_signature",
    viewSignedDocumentAllowed: hasDurableDocument,
  };
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
    status === "failed" ||
    status === "ambiguous_terminal_state"
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
    .sort(compareEvents);
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
  documentMetadata?: {
    documentId?: string | null;
    documentHash?: string | null;
    manifestHash?: string | null;
    templateVersion?: string | null;
    jurisdictionCode?: string | null;
    providerAccessUrlExpiresAt?: string | null;
    signingFieldPlacement?: SigningProviderFieldPlacement | null;
  } | null;
}) {
  const occurredAt = input.occurredAt || nowIso();
  const id = eventIdFor(input.requestId, input.type, occurredAt, input.providerEventId || "");
  const ref = db.collection(EVENTS).doc(id);
  const eventData = {
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
    documentId: input.documentMetadata?.documentId || null,
    documentHash: input.documentMetadata?.documentHash || null,
    manifestHash: input.documentMetadata?.manifestHash || null,
    templateVersion: input.documentMetadata?.templateVersion || null,
    jurisdictionCode: input.documentMetadata?.jurisdictionCode || null,
    occurredAt,
    createdAt: FieldValue.serverTimestamp(),
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  const transactionResult = await db.runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
    const eventQuery = db.collection(EVENTS).where("requestId", "==", input.requestId);
    const leaseRef = input.type === "signed" ? db.collection("leases").doc(input.leaseId) : null;
    const [existing, eventSnap, leaseSnap] = await Promise.all([
      transaction.get(ref),
      transaction.get(eventQuery),
      leaseRef ? transaction.get(leaseRef) : Promise.resolve(null),
    ]);
    if (existing.exists) return { created: false, currentSigningStatus: null as LeaseSigningStatus | null };
    const events = (eventSnap.docs || [])
      .map(projectEvent)
      .filter((event) => event.id && event.type && event.occurredAt)
      .concat({ id, type: input.type, occurredAt, actorRole: input.actorRole });
    const currentSigningStatus = statusFromEvents(events);
    transaction.set(ref, eventData);
    transaction.set(db.collection(REQUESTS).doc(input.requestId), {
      currentSigningStatus,
      currentStatusAt: [...events].sort(compareEvents).at(-1)?.occurredAt || occurredAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const lease = leaseSnap?.exists ? leaseSnap.data() as any : null;
    if (
      leaseRef &&
      currentSigningStatus === "signed" &&
      lease &&
      String(lease.landlordId || "").trim() === input.landlordId
    ) {
      transaction.set(leaseRef, {
        executionStatus: "fully_executed",
        executionState: "fully_executed",
        fullyExecutedAt: occurredAt,
        updatedAt: occurredAt,
      }, { merge: true });
    }
    return { created: true, currentSigningStatus };
  });
  if (!transactionResult.created) return { id, ...transactionResult };
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
      documentId: input.documentMetadata?.documentId || null,
      documentHash: input.documentMetadata?.documentHash || null,
      manifestHash: input.documentMetadata?.manifestHash || null,
      templateVersion: input.documentMetadata?.templateVersion || null,
      jurisdictionCode: input.documentMetadata?.jurisdictionCode || null,
    },
  }).catch(() => undefined);
  return { id, ...transactionResult };
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
    const derivedLeaseState = deriveLeaseSigningState({ lease: input.lease || {}, signingStatus: "not_started" });
    return {
      ...buildSigningDocumentProjection({ signingStatus: "not_started", derivedLeaseState, events: [] }),
      signingStatus: "not_started",
      derivedLeaseState,
      signingProviderId: null,
      signingRequestId: null,
      providerRequestRef: null,
      providerDispatchMode: null,
      providerDispatchStatus: null,
      providerDispatchMessage: null,
      sentAt: null,
      signedAt: null,
      currentStatusAt: null,
      documentUrl: null,
      signedDocumentHash: null,
      signedDocumentStoredAt: null,
      signedDocumentSource: null,
      events: [],
    };
  }
  const events = await loadEvents(request.id);
  const signingStatus = events.length ? statusFromEvents(events) : normalizeStoredStatus(request.data?.currentSigningStatus) || "not_started";
  const signedAt = [...events].reverse().find((event) => event.type === "signed")?.occurredAt || null;
  const sentAt = [...events].reverse().find((event) => event.type === "sent")?.occurredAt || String(request.data?.sentAt || "") || null;
  const currentStatusAt = events.at(-1)?.occurredAt || String(request.data?.currentStatusAt || "") || null;
  const providerId = String(request.data?.providerId || "");
  const providerDispatchMode = String(request.data?.providerDispatchMode || (providerId === "mock" ? "mock" : "")).trim() || null;
  const providerDispatchStatus = String(request.data?.providerDispatchStatus || (providerId === "mock" ? "mocked_no_email" : "")).trim() || null;
  const derivedLeaseState = deriveLeaseSigningState({ lease: input.lease || {}, signingStatus });
  const documentProjection = buildSigningDocumentProjection({ signingStatus, derivedLeaseState, events, requestData: request.data });
  const signedDocument = documentProjection.signedDocumentAvailable ? await signedDocumentDownloadFromRequest(request.data) : null;
  return {
    ...documentProjection,
    signingStatus,
    derivedLeaseState,
    signingProviderId: providerId,
    signingRequestId: request.id,
    providerRequestRef: String(request.data?.providerRequestRef || ""),
    providerDispatchMode,
    providerDispatchStatus,
    providerDispatchMessage: String(request.data?.providerDispatchMessage || (providerId === "mock" ? "Mock signing provider recorded the request without sending email." : "")).trim() || null,
    sentAt,
    signedAt,
    currentStatusAt,
    documentUrl: signedDocument?.documentUrl || null,
    signedDocumentHash: signedDocument?.documentHash || null,
    signedDocumentStoredAt: signedDocument?.signedDocumentStoredAt || null,
    signedDocumentSource: signedDocument?.source || null,
    events: collapseEventsForProjection(events),
  };
}

export async function getSignedLeaseDocumentDownload(input: {
  leaseId: string;
  landlordId: string;
}): Promise<SignedLeaseDocumentDownload> {
  const request = await loadLatestRequest(input.leaseId, input.landlordId);
  if (!request) {
    return {
      documentUrl: null,
      expiresInSeconds: null,
      documentHash: null,
      signedDocumentStoredAt: null,
      source: null,
    };
  }
  const events = await loadEvents(request.id);
  const signingStatus = events.length ? statusFromEvents(events) : normalizeStoredStatus(request.data?.currentSigningStatus) || "not_started";
  const projection = buildSigningDocumentProjection({
    signingStatus,
    derivedLeaseState: deriveLeaseSigningState({ lease: {}, signingStatus }),
    events,
    requestData: request.data,
  });
  if (!projection.signedDocumentAvailable) {
    return {
      documentUrl: null,
      expiresInSeconds: null,
      documentHash: String(request.data?.signedDocumentHash || "") || null,
      signedDocumentStoredAt: String(request.data?.signedDocumentStoredAt || "") || null,
      source: null,
    };
  }
  return signedDocumentDownloadFromRequest(request.data);
}

export async function sendLeaseForSignature(input: {
  leaseId: string;
  lease: Record<string, any>;
  landlordId: string;
  tenantEmails: string[];
  message?: string | null;
  providerDocumentUrl?: string | null;
  documentMetadata?: {
    documentId?: string | null;
    documentHash?: string | null;
    manifestHash?: string | null;
    templateVersion?: string | null;
    jurisdictionCode?: string | null;
    providerAccessUrlExpiresAt?: string | null;
    signingFieldPlacement?: SigningProviderFieldPlacement | null;
  } | null;
}) {
  const provider = getConfiguredSigningProvider();
  if (!provider?.isConfigured()) throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  const current = await loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
  if (current.signingStatus === "ambiguous_terminal_state") {
    throw Object.assign(new Error("signing_state_ambiguous"), { status: 409 });
  }
  if (current.signingStatus === "signed") throw Object.assign(new Error("signing_already_complete"), { status: 400 });
  if (current.signingStatus === "pending_signature") throw Object.assign(new Error("signing_already_pending"), { status: 400 });
  const emails = input.tenantEmails.map(normalizeEmail).filter(Boolean);
  if (!emails.length || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw Object.assign(new Error("invalid_tenant_email"), { status: 400 });
  }

  const documentUrl = String(
    input.providerDocumentUrl ||
      input.lease?.documentUrl ||
      input.lease?.approvedDocumentUrl ||
      input.lease?.documentRef ||
      ""
  ).trim();
  const sent = await provider.sendForSignature({
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    documentUrl,
    title: "Lease signature request",
    message: input.message || null,
    signers: emails.map((email) => ({ email, role: "tenant" as const })),
    callbackUrl: process.env.SIGNING_PROVIDER_CALLBACK_URL || process.env.SIGNING_CALLBACK_URL || null,
    returnUrl: signingReturnUrl(),
    fieldPlacement: input.documentMetadata?.signingFieldPlacement || null,
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
      expiresAt: sent.expiresAt || null,
      providerDispatchMode: sent.dispatchMode || null,
      providerDispatchStatus: sent.dispatchStatus || null,
      providerDispatchMessage: sent.dispatchMessage || null,
      providerTestMode: sent.providerTestMode ?? null,
      documentId: input.documentMetadata?.documentId || null,
      documentHash: input.documentMetadata?.documentHash || null,
      manifestHash: input.documentMetadata?.manifestHash || null,
      templateVersion: input.documentMetadata?.templateVersion || null,
      jurisdictionCode: input.documentMetadata?.jurisdictionCode || null,
      providerAccessUrlExpiresAt: input.documentMetadata?.providerAccessUrlExpiresAt || null,
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
    documentMetadata: input.documentMetadata || null,
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
    ...safeProviderMetadataFromRequest(request.data),
    documentMetadata: safeDocumentMetadataFromRequest(request.data),
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
    ...safeProviderMetadataFromRequest(request.data),
    documentMetadata: safeDocumentMetadataFromRequest(request.data),
  });
  return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
}

export async function downloadSignedLease(input: { leaseId: string; lease: Record<string, any>; landlordId: string }) {
  const request = await loadLatestRequest(input.leaseId, input.landlordId);
  if (!request) throw Object.assign(new Error("lease_not_found"), { status: 404 });
  const events = await loadEvents(request.id);
  const signingStatus = events.length ? statusFromEvents(events) : normalizeStoredStatus(request.data?.currentSigningStatus) || "not_started";
  const existingSignedDocumentRef = signedDocumentStorageRefFromRequest(request.data);
  if (existingSignedDocumentRef) {
    if (existingSignedDocumentRef.source === "legacySignedDocumentUrl") {
      await db.collection(REQUESTS).doc(request.id).set(
        {
          signedDocument: {
            bucket: existingSignedDocumentRef.bucket,
            path: existingSignedDocumentRef.path,
            internalReferenceOnly: true,
          },
          signedDocumentUrl: null,
        },
        { merge: true }
      );
    }
    return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
  }
  if (signingStatus !== "signed" || !events.some((event) => event.type === "signed")) {
    throw Object.assign(new Error("signed_document_not_found"), { status: 404 });
  }
  const provider = signingProviderRegistry.getProvider(String(request.data?.providerId || ""));
  if (!provider?.isConfigured()) throw Object.assign(new Error("provider_unavailable"), { status: 503 });
  let doc;
  try {
    doc = await provider.downloadSignedDocument(String(request.data?.providerRequestId || ""));
  } catch {
    await db.collection(REQUESTS).doc(request.id).set({
      signedDocumentPersistenceStatus: "failed",
      signedDocumentPersistenceFailureCode: "provider_download_failed",
      signedDocumentPersistenceFailedAt: nowIso(),
    }, { merge: true });
    throw Object.assign(new Error("signed_document_persistence_failed"), { status: 503 });
  }
  if (!doc) {
    await db.collection(REQUESTS).doc(request.id).set({
      signedDocumentPersistenceStatus: "failed",
      signedDocumentPersistenceFailureCode: "provider_document_unavailable",
      signedDocumentPersistenceFailedAt: nowIso(),
    }, { merge: true });
    throw Object.assign(new Error("signed_document_persistence_failed"), { status: 503 });
  }
  const storagePath = `lease-signing/${digest(input.landlordId, 12)}/${request.id}/${doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  try {
    const uploaded = await uploadBufferToGcs({
      path: storagePath,
      contentType: doc.contentType,
      buffer: doc.buffer,
      metadata: { leaseSigningRequestId: request.id },
    });
    await db.collection(REQUESTS).doc(request.id).set(
      {
        signedDocument: {
          bucket: uploaded.bucket,
          path: uploaded.path,
          contentType: doc.contentType,
          fileName: doc.fileName,
          internalReferenceOnly: true,
        },
        signedDocumentUrl: null,
        signedDocumentHash: createHash("sha256").update(doc.buffer).digest("hex"),
        signedDocumentStoredAt: nowIso(),
        signedDocumentPersistenceStatus: "available",
        signedDocumentPersistenceFailureCode: null,
        signedDocumentPersistenceFailedAt: null,
      },
      { merge: true }
    );
  } catch {
    await db.collection(REQUESTS).doc(request.id).set({
      signedDocumentPersistenceStatus: "failed",
      signedDocumentPersistenceFailureCode: "canonical_persistence_failed",
      signedDocumentPersistenceFailedAt: nowIso(),
    }, { merge: true }).catch(() => undefined);
    throw Object.assign(new Error("signed_document_persistence_failed"), { status: 503 });
  }
  await appendSigningEvent({
    requestId: request.id,
    leaseId: input.leaseId,
    landlordId: input.landlordId,
    providerId: provider.getProviderId(),
    providerRequestId: String(request.data?.providerRequestId || ""),
    type: "downloaded",
    actorRole: "landlord",
    ...safeProviderMetadataFromRequest(request.data),
    documentMetadata: safeDocumentMetadataFromRequest(request.data),
  });
  return loadLeaseSigningSnapshot({ leaseId: input.leaseId, landlordId: input.landlordId, lease: input.lease });
}

export type SigningWebhookProcessResult = {
  providerResponseText?: string;
};

export async function processSigningWebhook(input: { providerId: string; headers: any; body: any; rawBody?: Buffer }): Promise<SigningWebhookProcessResult> {
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
  if (!parsed.providerRequestId && parsed.accountCallback) {
    await db.collection(DEAD_LETTERS).doc(`dl_${digest(`${input.providerId}:${parsed.providerEventId || Date.now()}`, 24)}`).set({
      providerId: input.providerId,
      status: "account_callback_acknowledged",
      providerEventRef: safeProviderRef(provider.getProviderId(), parsed.providerEventId || ""),
      providerEventType: parsed.providerEventType || null,
      createdAt: FieldValue.serverTimestamp(),
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    return provider.getProviderId() === "dropbox_sign" ? { providerResponseText: "Hello API Event Received" } : {};
  }
  const providerRequestId = String(parsed.providerRequestId || "");
  const requestSnap = await db.collection(REQUESTS).where("providerRequestRef", "==", safeProviderRef(provider.getProviderId(), providerRequestId)).limit(1).get();
  const requestDoc = requestSnap.docs?.[0];
  if (!requestDoc) {
    await db.collection(DEAD_LETTERS).doc(`dl_${digest(`${input.providerId}:${parsed.providerEventId || Date.now()}`, 24)}`).set({
      providerId: input.providerId,
      status: "request_not_found",
      providerRequestRef: safeProviderRef(provider.getProviderId(), providerRequestId),
      providerEventRef: safeProviderRef(provider.getProviderId(), parsed.providerEventId || ""),
      providerEventType: parsed.providerEventType || null,
      createdAt: FieldValue.serverTimestamp(),
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    return {};
  }
  const data = requestDoc.data() as any;
  if (parsed.type === "signed") {
    const leaseId = String(data?.leaseId || "").trim();
    const landlordId = String(data?.landlordId || "").trim();
    const occurredAt = String(parsed.occurredAt || "").trim();
    const eventIdentity = String(parsed.providerEventId || "").trim();
    if (!leaseId || !landlordId || !occurredAt || !eventIdentity) {
      throw Object.assign(new Error("signing_completion_identity_incomplete"), { status: 409 });
    }
  }
  await appendSigningEvent({
    requestId: requestDoc.id,
    leaseId: String(data?.leaseId || ""),
    landlordId: String(data?.landlordId || ""),
    providerId: provider.getProviderId(),
    providerRequestId,
    providerEventId: parsed.providerEventId,
    type: parsed.type,
    actorRole: "provider",
    signerEmail: parsed.signerEmail || null,
    occurredAt: parsed.occurredAt,
    ...safeProviderMetadataFromRequest(data),
    documentMetadata: safeDocumentMetadataFromRequest(data),
  });
  return {};
}

export function signingErrorStatus(error: any) {
  return Number(error?.status || 500);
}

export function signingErrorCode(error: any) {
  const code = String(error?.message || "lease_signing_failed");
  return code.includes(" ") ? "lease_signing_failed" : code;
}
