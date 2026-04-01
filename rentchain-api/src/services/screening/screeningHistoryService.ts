import { db } from "../../config/firebase";
import type {
  ScreeningAuditSnapshot,
  ScreeningHistoryDetail,
  ScreeningHistoryRecord,
  ScreeningReportSnapshot,
  ScreeningRecordStatus,
  ScreeningResultState,
  ScreeningRiskLevel,
  ScreeningSummarySnapshot,
} from "../../types/screening";
import { getScreeningRequestById, getScreeningRequestForApplication } from "../screeningRequestService";
import { resolveScreeningProviderAdapter } from "./screeningProviderAdapter";

type ListParams = {
  landlordId: string;
  applicationId?: string | null;
  tenantId?: string | null;
  limit?: number;
};

type FindByIdParams = {
  landlordId: string;
  screeningId: string;
};

type RawScreeningRecord = {
  id: string;
  applicationId: string | null;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  applicantName: string | null;
  tenantId: string | null;
  providerValue: string | null;
  providerReferenceId: string | null;
  screeningType: string | null;
  sourceType: "order" | "request";
  sourceId: string;
  referenceId: string | null;
  packageType: string | null;
  requestedByUserId: string | null;
  requestedByLabel: string | null;
  applicationStatus: string | null;
  orderStatus: string | null;
  resultSummary: any;
  resultReportText: string | null;
  orderData: any | null;
  requestData: any | null;
  events: Array<any>;
  createdAt: number | string | null;
  updatedAt: number | string | null;
  requestedAt: number | string | null;
  screenedAt: number | string | null;
};

function normalizeStatus(value: unknown): ScreeningRecordStatus {
  const status = String(value || "").trim().toLowerCase();
  if (["complete", "completed", "paid"].includes(status)) return status === "paid" ? "pending" : "completed";
  if (["failed", "error"].includes(status)) return "failed";
  return "pending";
}

function normalizeResult(value: unknown): ScreeningResultState {
  const result = String(value || "").trim().toLowerCase();
  if (["pass", "approved", "approve"].includes(result)) return "approved";
  if (["review", "manual_review"].includes(result)) return "review";
  if (["fail", "failed", "declined", "decline"].includes(result)) return "declined";
  return "unknown";
}

function normalizeRiskLevel(value: unknown): ScreeningRiskLevel {
  const risk = String(value || "").trim().toLowerCase();
  if (["low", "a", "b", "pass"].includes(risk)) return "low";
  if (["medium", "c", "review"].includes(risk)) return "medium";
  if (["high", "d", "e", "fail", "declined"].includes(risk)) return "high";
  return "unknown";
}

function normalizeSummary(raw: any): ScreeningSummarySnapshot {
  return {
    recommendation: raw?.overall || raw?.recommendation || null,
    scoreBand: raw?.scoreBand || raw?.riskBand || null,
    confidence: raw?.confidence || null,
    openAccounts: typeof raw?.openAccounts === "number" ? raw.openAccounts : null,
    pastDueTotal: typeof raw?.pastDueTotal === "number" ? raw.pastDueTotal : null,
    collectionsPresent: typeof raw?.collectionsPresent === "boolean" ? raw.collectionsPresent : null,
    bankruptcyPresent: typeof raw?.bankruptcyPresent === "boolean" ? raw.bankruptcyPresent : null,
    inquiriesCount: typeof raw?.inquiriesCount === "number" ? raw.inquiriesCount : null,
    flags: Array.isArray(raw?.flags) ? raw.flags.filter(Boolean) : [],
    notes: raw?.headline || raw?.notes || raw?.summary || null,
  };
}

function normalizeReport(raw: RawScreeningRecord): ScreeningReportSnapshot {
  const order = raw.orderData || {};
  const request = raw.requestData || {};
  const hasStoredFile = Boolean(order?.reportBucket && order?.reportObjectKey);
  const statusValue = String(order?.status || request?.status || raw.orderStatus || "").toLowerCase();
  const archivedAt = order?.archivedAt || order?.reportArchivedAt || null;
  const retrievalRequired = Boolean(order?.retrievalRequired || order?.retrievalCost);

  if (hasStoredFile) {
    return {
      status: archivedAt ? "archived" : "available",
      storageMode: "rentchain_encrypted",
      fileRef: `${order.reportBucket}/${order.reportObjectKey}`,
      archivedAt,
      retrievalCost: typeof order?.retrievalCost === "number" ? order.retrievalCost : null,
      retrievalRequired,
    };
  }

  if (archivedAt) {
    return {
      status: retrievalRequired ? "retrieval_required" : "archived",
      storageMode: "provider_only",
      fileRef: null,
      archivedAt,
      retrievalCost: typeof order?.retrievalCost === "number" ? order.retrievalCost : null,
      retrievalRequired,
    };
  }

  if (["failed", "error"].includes(statusValue)) {
    return {
      status: "failed",
      storageMode: "none",
      fileRef: null,
      archivedAt: null,
      retrievalCost: null,
      retrievalRequired: false,
    };
  }

  if (["unpaid", "paid", "processing", "pending", "external_pending", "requested"].includes(statusValue)) {
    return {
      status: "pending",
      storageMode: "none",
      fileRef: null,
      archivedAt: null,
      retrievalCost: null,
      retrievalRequired: false,
    };
  }

  return {
    status: "not_stored",
    storageMode: "none",
    fileRef: null,
    archivedAt: null,
    retrievalCost: null,
    retrievalRequired: false,
  };
}

function normalizeAudit(events: Array<any>): ScreeningAuditSnapshot {
  const reportViews = events
    .filter((event) => event?.type === "report_viewed")
    .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0));
  const lastView = reportViews[0] || null;
  return {
    lastViewedAt: lastView?.at ?? null,
    lastViewedByUserId: lastView?.meta?.actorId || null,
    accessCount: reportViews.length,
  };
}

function buildRecord(raw: RawScreeningRecord): ScreeningHistoryRecord {
  const provider = resolveScreeningProviderAdapter(raw.providerValue);
  const summary = normalizeSummary(raw.resultSummary);
  const result = normalizeResult(summary.recommendation);
  return {
    id: raw.id,
    landlordId: raw.landlordId,
    propertyId: raw.propertyId,
    unitId: raw.unitId,
    applicationId: raw.applicationId,
    tenantId: raw.tenantId,
    applicantName: raw.applicantName,
    provider: provider.provider,
    providerReferenceId: raw.providerReferenceId,
    screeningType: raw.screeningType,
    status: normalizeStatus(raw.orderStatus || raw.requestData?.status),
    result,
    riskLevel: normalizeRiskLevel(summary.scoreBand || result),
    screenedAt: raw.screenedAt,
    requestedAt: raw.requestedAt,
    requestedByUserId: raw.requestedByUserId,
    summary,
    report: normalizeReport(raw),
    audit: normalizeAudit(raw.events),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function buildDetail(raw: RawScreeningRecord): ScreeningHistoryDetail {
  const record = buildRecord(raw);
  return {
    ...record,
    propertyLabel: raw.propertyLabel,
    unitLabel: raw.unitLabel,
    applicationStatus: raw.applicationStatus,
    metadata: {
      sourceType: raw.sourceType,
      sourceId: raw.sourceId,
      referenceId: raw.referenceId,
      packageType: raw.packageType,
      requestedByLabel: raw.requestedByLabel,
    },
  };
}

async function getApplication(applicationId: string) {
  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

async function getEventsForApplication(applicationId: string) {
  const snap = await db.collection("screeningEvents").where("applicationId", "==", applicationId).limit(100).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
}

async function getOrdersForApplication(applicationId: string) {
  const snap = await db.collection("screeningOrders").where("applicationId", "==", applicationId).limit(25).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
}

async function getResult(resultId: string | null | undefined) {
  const id = String(resultId || "").trim();
  if (!id) return null;
  const snap = await db.collection("screeningResults").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

async function collectRawRecordsForApplication(applicationId: string, landlordId: string): Promise<RawScreeningRecord[]> {
  const application = await getApplication(applicationId);
  if (!application || String(application.landlordId || "").trim() !== String(landlordId || "").trim()) {
    return [];
  }

  const [orders, events, result, legacyRequest] = await Promise.all([
    getOrdersForApplication(applicationId),
    getEventsForApplication(applicationId),
    getResult(application.screeningResultId),
    Promise.resolve(getScreeningRequestForApplication(applicationId)),
  ]);

  const eventGroups = new Map<string, Array<any>>();
  for (const event of events) {
    const orderId = String(event?.orderId || "").trim();
    if (orderId) {
      const existing = eventGroups.get(orderId) || [];
      existing.push(event);
      eventGroups.set(orderId, existing);
    }
  }

  const applicantName =
    [application?.applicant?.firstName, application?.applicant?.lastName].filter(Boolean).join(" ").trim() ||
    application?.fullName ||
    null;
  const unitLabel = application?.unitApplied || application?.unit || null;
  const propertyLabel = application?.propertyName || null;
  const requestedByUserId = application?.requestedByUserId || null;
  const requestedByLabel = application?.requestedByUserId ? "Landlord" : null;

  const orderRecords: RawScreeningRecord[] = orders.map((order) => ({
    id: order.id,
    applicationId,
    landlordId,
    propertyId: order.propertyId || application.propertyId || null,
    unitId: order.unitId || application.unitId || null,
    propertyLabel,
    unitLabel,
    applicantName,
    tenantId: application.tenantId || null,
    providerValue: order.provider || application.screeningProvider || null,
    providerReferenceId: order.providerRequestId || order.referenceId || null,
    screeningType: order.screeningTier || order.serviceLevel || null,
    sourceType: "order",
    sourceId: order.id,
    referenceId: order.referenceId || null,
    packageType: order.screeningTier || order.serviceLevel || null,
    requestedByUserId,
    requestedByLabel,
    applicationStatus: application.status || null,
    orderStatus: order.status || null,
    resultSummary: result?.summary || application.screeningResultSummary || null,
    resultReportText: result?.reportText || null,
    orderData: order,
    requestData: null,
    events: eventGroups.get(order.id) || events,
    createdAt: order.createdAt || application.createdAt || null,
    updatedAt: order.updatedAt || application.screeningLastUpdatedAt || application.updatedAt || null,
    requestedAt: order.createdAt || application.createdAt || null,
    screenedAt:
      order.reportGeneratedAt ||
      result?.updatedAt ||
      application.screeningCompletedAt ||
      order.completedAt ||
      null,
  }));

  if (orderRecords.length > 0) {
    return orderRecords.sort(
      (a, b) => Number(b.screenedAt || b.updatedAt || b.createdAt || 0) - Number(a.screenedAt || a.updatedAt || a.createdAt || 0)
    );
  }

  if (!legacyRequest || String(legacyRequest.landlordId || "").trim() !== String(landlordId || "").trim()) {
    return [];
  }

  return [
    {
      id: `request:${legacyRequest.id}`,
      applicationId,
      landlordId,
      propertyId: application.propertyId || null,
      unitId: application.unitId || null,
      propertyLabel,
      unitLabel,
      applicantName,
      tenantId: application.tenantId || null,
      providerValue: legacyRequest.providerName || application.screeningProvider || null,
      providerReferenceId: legacyRequest.providerReferenceId || null,
      screeningType: "legacy_request",
      sourceType: "request",
      sourceId: legacyRequest.id,
      referenceId: legacyRequest.providerReferenceId || null,
      packageType: null,
      requestedByUserId,
      requestedByLabel,
      applicationStatus: application.status || null,
      orderStatus: legacyRequest.status || null,
      resultSummary: legacyRequest.reportSummary || application.screeningResultSummary || null,
      resultReportText: legacyRequest.creditReport?.summary || null,
      orderData: null,
      requestData: legacyRequest,
      events,
      createdAt: legacyRequest.createdAt || application.createdAt || null,
      updatedAt: legacyRequest.completedAt || legacyRequest.createdAt || application.updatedAt || null,
      requestedAt: legacyRequest.createdAt || application.createdAt || null,
      screenedAt: legacyRequest.completedAt || null,
    },
  ];
}

function dedupeRecords(records: RawScreeningRecord[]) {
  const seen = new Set<string>();
  const deduped: RawScreeningRecord[] = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    deduped.push(record);
  }
  return deduped;
}

export async function listScreeningHistory(params: ListParams): Promise<ScreeningHistoryRecord[]> {
  const limit = Number.isFinite(params.limit) ? Math.min(Math.max(Number(params.limit), 1), 20) : 10;
  const applicationId = String(params.applicationId || "").trim();
  if (applicationId) {
    const records = await collectRawRecordsForApplication(applicationId, params.landlordId);
    return dedupeRecords(records).slice(0, limit).map(buildRecord);
  }

  let query = db.collection("rentalApplications").where("landlordId", "==", params.landlordId).limit(limit);
  if (params.tenantId) {
    query = db.collection("rentalApplications").where("tenantId", "==", params.tenantId).limit(limit);
  }
  const snap = await query.get();
  const records = (
    await Promise.all(
      snap.docs.map((doc) => collectRawRecordsForApplication(doc.id, params.landlordId))
    )
  ).flat();
  return dedupeRecords(records)
    .sort((a, b) => Number(b.screenedAt || b.updatedAt || b.createdAt || 0) - Number(a.screenedAt || a.updatedAt || a.createdAt || 0))
    .slice(0, limit)
    .map(buildRecord);
}

export async function getScreeningHistoryDetail(params: FindByIdParams): Promise<ScreeningHistoryDetail | null> {
  const id = String(params.screeningId || "").trim();
  if (!id) return null;

  if (id.startsWith("request:")) {
    const requestId = id.slice("request:".length);
    const request = getScreeningRequestById(requestId);
    if (!request || String(request.landlordId || "").trim() !== String(params.landlordId || "").trim()) {
      return null;
    }
    const records = await collectRawRecordsForApplication(String(request.applicationId || ""), params.landlordId);
    const record = records.find((item) => item.id === id);
    return record ? buildDetail(record) : null;
  }

  const orderSnap = await db.collection("screeningOrders").doc(id).get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data() as any;
  if (String(order?.landlordId || "").trim() !== String(params.landlordId || "").trim()) {
    return null;
  }
  const records = await collectRawRecordsForApplication(String(order?.applicationId || ""), params.landlordId);
  const record = records.find((item) => item.id === id);
  return record ? buildDetail(record) : null;
}
