import crypto from "crypto";
import { db } from "../../firebase";
import type {
  ScreeningConsent,
  ScreeningConsentStatus,
  ScreeningDecisionStatus,
  ScreeningProviderParsedWebhook,
  ScreeningRequest,
  ScreeningRequestProjection,
  ScreeningResult,
  ScreeningResultProjection,
  ScreeningWebhookLog,
  ScreeningWorkflowAuditEntry,
  ScreeningWorkflowStatus,
} from "../../types/providerNeutralScreening";

const CONSENTS = "screeningConsents";
const REQUESTS = "screeningRequests";
const RESULTS = "screeningResults";
const WEBHOOK_LOGS = "screeningWebhookLogs";
const UNITS = "units";

type ActorRole = ScreeningWorkflowAuditEntry["actorRole"];

function nowIso() {
  return new Date().toISOString();
}

function digest(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function safeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function audit(action: ScreeningWorkflowAuditEntry["action"], actorRole: ActorRole, actorRef: string, note?: string) {
  return {
    action,
    actorRole,
    actorRef: hashRef(actorRef),
    at: nowIso(),
    ...(note ? { note } : {}),
  };
}

export function hashRef(value: string) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function coerceString(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function assertRequired(value: unknown, code: string) {
  const normalized = coerceString(value);
  if (!normalized) throw new ScreeningWorkflowError(400, code);
  return normalized;
}

function normalizeDecision(value: unknown): Exclude<ScreeningDecisionStatus, "not_started"> {
  const decision = coerceString(value, 40);
  if (decision === "approve" || decision === "deny" || decision === "review_needed") return decision;
  throw new ScreeningWorkflowError(400, "INVALID_DECISION");
}

function normalizeStatus(value: unknown): ScreeningWorkflowStatus {
  const status = coerceString(value, 40);
  if (
    status === "pending" ||
    status === "provider_pending" ||
    status === "completed" ||
    status === "manual_completed" ||
    status === "failed" ||
    status === "expired"
  ) {
    return status;
  }
  return "pending";
}

function normalizeConsentStatus(value: unknown): ScreeningConsentStatus {
  return value === "revoked" ? "revoked" : "active";
}

function consentFromDoc(id: string, data: any): ScreeningConsent {
  return {
    id,
    tenantId: String(data?.tenantId || ""),
    landlordId: String(data?.landlordId || ""),
    unitId: String(data?.unitId || ""),
    consentType: "screening",
    status: normalizeConsentStatus(data?.status),
    grantedAt: String(data?.grantedAt || ""),
    revokedAt: data?.revokedAt ? String(data.revokedAt) : null,
    auditLog: Array.isArray(data?.auditLog) ? data.auditLog : [],
  };
}

function requestFromDoc(id: string, data: any): ScreeningRequest {
  return {
    id,
    landlordId: String(data?.landlordId || ""),
    unitId: String(data?.unitId || ""),
    tenantId: String(data?.tenantId || ""),
    consentId: String(data?.consentId || ""),
    providerId: data?.providerId ? String(data.providerId) : null,
    status: normalizeStatus(data?.status),
    requestedAt: String(data?.requestedAt || ""),
    resultReceivedAt: data?.resultReceivedAt ? String(data.resultReceivedAt) : null,
    manualReportUrl: data?.manualReportUrl ? String(data.manualReportUrl) : null,
    manualReportUploadedAt: data?.manualReportUploadedAt ? String(data.manualReportUploadedAt) : null,
    decisionStatus: data?.decisionStatus === "approve" || data?.decisionStatus === "deny" || data?.decisionStatus === "review_needed"
      ? data.decisionStatus
      : "not_started",
    decisionReason: data?.decisionReason ? String(data.decisionReason) : null,
    decisionNotes: data?.decisionNotes ? String(data.decisionNotes) : null,
    decisionMadeAt: data?.decisionMadeAt ? String(data.decisionMadeAt) : null,
    auditLog: Array.isArray(data?.auditLog) ? data.auditLog : [],
  };
}

function resultFromDoc(id: string, data: any): ScreeningResult {
  return {
    id,
    requestId: String(data?.requestId || ""),
    tenantId: String(data?.tenantId || ""),
    landlordId: String(data?.landlordId || ""),
    providerId: String(data?.providerId || ""),
    payloadDigest: String(data?.payloadDigest || ""),
    parsedResult: data?.parsedResult || { status: "completed", flags: [] },
    riskScore: typeof data?.riskScore === "number" ? data.riskScore : null,
    decisionRecommendation:
      data?.decisionRecommendation === "approve" ||
      data?.decisionRecommendation === "deny" ||
      data?.decisionRecommendation === "review_needed"
        ? data.decisionRecommendation
        : null,
    receivedAt: String(data?.receivedAt || ""),
    expiresAt: String(data?.expiresAt || ""),
  };
}

export class ScreeningWorkflowError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function assertUnitOwnedByLandlord(unitId: string, landlordId: string) {
  const snap = await db.collection(UNITS).doc(unitId).get();
  if (!snap.exists) throw new ScreeningWorkflowError(404, "UNIT_NOT_FOUND");
  const data = snap.data() as any;
  if (String(data?.landlordId || "") !== landlordId) {
    throw new ScreeningWorkflowError(403, "UNIT_FORBIDDEN");
  }
}

export class ScreeningConsentService {
  async grantConsent(input: { tenantId: string; landlordId: string; unitId: string; actorTenantId: string }) {
    const tenantId = assertRequired(input.tenantId, "TENANT_REQUIRED");
    if (tenantId !== input.actorTenantId) throw new ScreeningWorkflowError(403, "TENANT_FORBIDDEN");
    const landlordId = assertRequired(input.landlordId, "LANDLORD_REQUIRED");
    const unitId = assertRequired(input.unitId, "UNIT_REQUIRED");
    const id = safeId("consent");
    const grantedAt = nowIso();
    const consent: ScreeningConsent = {
      id,
      tenantId,
      landlordId,
      unitId,
      consentType: "screening",
      status: "active",
      grantedAt,
      revokedAt: null,
      auditLog: [audit("consent_granted", "tenant", tenantId)],
    };
    await db.collection(CONSENTS).doc(id).set(consent);
    return consent;
  }

  async revokeConsent(input: { tenantId: string; consentId: string; actorTenantId: string }) {
    const tenantId = assertRequired(input.tenantId, "TENANT_REQUIRED");
    if (tenantId !== input.actorTenantId) throw new ScreeningWorkflowError(403, "TENANT_FORBIDDEN");
    const consent = await this.getConsent(input.consentId);
    if (!consent || consent.tenantId !== tenantId) throw new ScreeningWorkflowError(404, "CONSENT_NOT_FOUND");
    const revokedAt = nowIso();
    const updated: ScreeningConsent = {
      ...consent,
      status: "revoked",
      revokedAt,
      auditLog: [...consent.auditLog, audit("consent_revoked", "tenant", tenantId)],
    };
    await db.collection(CONSENTS).doc(consent.id).set(updated, { merge: true });
    return updated;
  }

  async getConsent(consentId: string) {
    const snap = await db.collection(CONSENTS).doc(assertRequired(consentId, "CONSENT_REQUIRED")).get();
    if (!snap.exists) return null;
    return consentFromDoc(snap.id, snap.data());
  }

  async listActiveConsents(tenantId: string) {
    const snap = await db.collection(CONSENTS).where("tenantId", "==", tenantId).get();
    return snap.docs.map((doc: any) => consentFromDoc(doc.id, doc.data())).filter((consent) => consent.status === "active");
  }
}

export class ScreeningRequestService {
  constructor(private consentService = new ScreeningConsentService()) {}

  async initiateScreening(input: {
    landlordId: string;
    unitId: string;
    tenantId: string;
    consentId: string;
    providerId?: string | null;
  }) {
    const landlordId = assertRequired(input.landlordId, "LANDLORD_REQUIRED");
    const unitId = assertRequired(input.unitId, "UNIT_REQUIRED");
    const tenantId = assertRequired(input.tenantId, "TENANT_REQUIRED");
    const consentId = assertRequired(input.consentId, "CONSENT_REQUIRED");
    await assertUnitOwnedByLandlord(unitId, landlordId);
    const consent = await this.consentService.getConsent(consentId);
    if (!consent || consent.status !== "active") throw new ScreeningWorkflowError(400, "CONSENT_NOT_ACTIVE");
    if (consent.tenantId !== tenantId || consent.landlordId !== landlordId || consent.unitId !== unitId) {
      throw new ScreeningWorkflowError(400, "CONSENT_SCOPE_MISMATCH");
    }
    const request: ScreeningRequest = {
      id: safeId("screening"),
      landlordId,
      unitId,
      tenantId,
      consentId,
      providerId: input.providerId ? coerceString(input.providerId, 80) : null,
      status: input.providerId ? "provider_pending" : "pending",
      requestedAt: nowIso(),
      resultReceivedAt: null,
      manualReportUrl: null,
      manualReportUploadedAt: null,
      decisionStatus: "not_started",
      decisionReason: null,
      decisionNotes: null,
      decisionMadeAt: null,
      auditLog: [audit("request_created", "landlord", landlordId)],
    };
    await db.collection(REQUESTS).doc(request.id).set(request);
    return request;
  }

  async getRequest(requestId: string) {
    const snap = await db.collection(REQUESTS).doc(assertRequired(requestId, "REQUEST_REQUIRED")).get();
    if (!snap.exists) return null;
    return requestFromDoc(snap.id, snap.data());
  }

  async getOwnedRequest(requestId: string, landlordId: string, unitId: string) {
    const request = await this.getRequest(requestId);
    if (!request) throw new ScreeningWorkflowError(404, "REQUEST_NOT_FOUND");
    if (request.landlordId !== landlordId || request.unitId !== unitId) {
      throw new ScreeningWorkflowError(403, "REQUEST_FORBIDDEN");
    }
    return request;
  }

  async listUnitRequests(landlordId: string, unitId: string) {
    await assertUnitOwnedByLandlord(unitId, landlordId);
    const snap = await db.collection(REQUESTS).where("unitId", "==", unitId).get();
    return snap.docs
      .map((doc: any) => requestFromDoc(doc.id, doc.data()))
      .filter((request) => request.landlordId === landlordId);
  }

  async saveRequest(request: ScreeningRequest) {
    await db.collection(REQUESTS).doc(request.id).set(request, { merge: true });
    return request;
  }
}

export class ScreeningWebhookService {
  async recordWebhookLog(input: {
    providerId: string;
    headers: Record<string, string | string[] | undefined>;
    payload: unknown;
    verified: boolean;
    status: ScreeningWebhookLog["status"];
    parsedRequestId?: string | null;
    errorCode?: string | null;
  }) {
    const log: ScreeningWebhookLog = {
      id: safeId("webhook"),
      providerId: coerceString(input.providerId, 80),
      timestamp: nowIso(),
      signatureHeaderPresent: Boolean(input.headers["x-signature"] || input.headers["X-Signature"]),
      verified: input.verified,
      status: input.status,
      payloadDigest: digest(input.payload),
      parsedRequestId: input.parsedRequestId || null,
      errorCode: input.errorCode || null,
    };
    await db.collection(WEBHOOK_LOGS).doc(log.id).set(log);
    return log;
  }
}

export class ScreeningResultService {
  constructor(private requestService = new ScreeningRequestService()) {}

  async recordResult(input: { providerId: string; parsed: ScreeningProviderParsedWebhook; payload: unknown }) {
    const request = await this.requestService.getRequest(input.parsed.requestId);
    if (!request) throw new ScreeningWorkflowError(404, "REQUEST_NOT_FOUND");
    const receivedAt = nowIso();
    const result: ScreeningResult = {
      id: safeId("result"),
      requestId: request.id,
      tenantId: request.tenantId,
      landlordId: request.landlordId,
      providerId: coerceString(input.providerId, 80),
      payloadDigest: digest(input.payload),
      parsedResult: {
        status: input.parsed.status === "failed" ? "failed" : input.parsed.status === "pending" ? "provider_pending" : "completed",
        riskScore: typeof input.parsed.riskScore === "number" ? input.parsed.riskScore : null,
        decisionRecommendation: input.parsed.decisionRecommendation || null,
        summary: input.parsed.summary || null,
        flags: Array.isArray(input.parsed.flags) ? input.parsed.flags.map((flag) => coerceString(flag, 80)).filter(Boolean) : [],
      },
      riskScore: typeof input.parsed.riskScore === "number" ? input.parsed.riskScore : null,
      decisionRecommendation: input.parsed.decisionRecommendation || null,
      receivedAt,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    };
    await db.collection(RESULTS).doc(result.id).set(result);
    await this.requestService.saveRequest({
      ...request,
      providerId: input.providerId,
      status: input.parsed.status === "failed" ? "failed" : input.parsed.status === "pending" ? "provider_pending" : "completed",
      resultReceivedAt: receivedAt,
      auditLog: [...request.auditLog, audit("result_recorded", "provider", input.providerId)],
    });
    return result;
  }

  async getResultForRequest(requestId: string, landlordId: string) {
    const snap = await db.collection(RESULTS).where("requestId", "==", requestId).get();
    const results = snap.docs.map((doc: any) => resultFromDoc(doc.id, doc.data()));
    return results.find((result) => result.landlordId === landlordId) || null;
  }
}

export class ScreeningDecisionService {
  constructor(private requestService = new ScreeningRequestService()) {}

  async recordDecision(input: {
    landlordId: string;
    unitId: string;
    requestId: string;
    decision: unknown;
    reason: unknown;
    notes?: unknown;
  }) {
    const request = await this.requestService.getOwnedRequest(input.requestId, input.landlordId, input.unitId);
    const decidedAt = nowIso();
    const decision = normalizeDecision(input.decision);
    const updated: ScreeningRequest = {
      ...request,
      decisionStatus: decision,
      decisionReason: coerceString(input.reason, 400),
      decisionNotes: input.notes ? coerceString(input.notes, 1000) : null,
      decisionMadeAt: decidedAt,
      auditLog: [...request.auditLog, audit("decision_recorded", "landlord", input.landlordId)],
    };
    await this.requestService.saveRequest(updated);
    return updated;
  }
}

export class ScreeningManualReportService {
  constructor(private requestService = new ScreeningRequestService()) {}

  async recordManualReport(input: {
    landlordId: string;
    unitId: string;
    requestId: string;
    fileName: string;
    contentType: string;
    storageUrl: string;
  }) {
    const request = await this.requestService.getOwnedRequest(input.requestId, input.landlordId, input.unitId);
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(input.contentType)) throw new ScreeningWorkflowError(400, "UNSUPPORTED_REPORT_TYPE");
    const uploadedAt = nowIso();
    const updated: ScreeningRequest = {
      ...request,
      status: "manual_completed",
      manualReportUrl: input.storageUrl,
      manualReportUploadedAt: uploadedAt,
      auditLog: [...request.auditLog, audit("manual_report_recorded", "landlord", input.landlordId, coerceString(input.fileName, 120))],
    };
    await this.requestService.saveRequest(updated);
    return updated;
  }
}

export function projectRequest(request: ScreeningRequest): ScreeningRequestProjection {
  return {
    requestId: request.id,
    unitId: request.unitId,
    tenantId: request.tenantId,
    status: request.status,
    initiatedAt: request.requestedAt,
    resultReceivedAt: request.resultReceivedAt || null,
    decisionStatus: request.decisionStatus,
    manualReportUploadedAt: request.manualReportUploadedAt || null,
  };
}

export function projectResult(result: ScreeningResult): ScreeningResultProjection {
  return {
    requestId: result.requestId,
    riskScore: typeof result.riskScore === "number" ? result.riskScore : null,
    decisionRecommendation: result.decisionRecommendation || null,
    summary: result.parsedResult.summary || null,
    flags: Array.isArray(result.parsedResult.flags) ? result.parsedResult.flags : [],
  };
}
