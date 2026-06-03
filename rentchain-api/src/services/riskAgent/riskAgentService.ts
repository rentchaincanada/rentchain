import { db } from "../../firebase";
import { listLedgerEventsV2 } from "../ledgerEventsFirestoreService";
import { buildReviewSummary } from "../../lib/reviewSummary";
import { computeTenantSignals } from "../tenantSignalsService";
import { loadLatestRiskAgentResult, persistRiskAgentRun } from "./riskPersistenceService";
import { evaluateRiskAgentContext } from "./riskRulesEngine";
import type {
  RiskAgentApplicationContext,
  RiskAgentConsistencyStatus,
  RiskAgentDocumentStatus,
  RiskAgentEvaluation,
  RiskAgentIdentityStatus,
  RiskAgentLatestRecord,
  RiskAgentRunRecord,
} from "./riskTypes";

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toMonthlyIncome(application: any): number | null {
  const direct = numberOrNull(application?.monthlyIncome);
  const coApplicantIncome = numberOrNull(application?.coApplicant?.monthlyIncome) || 0;
  if (direct != null && direct > 0) return direct + coApplicantIncome;

  const employment = application?.applicantProfile?.employment || {};
  const incomeAmountCents = numberOrNull(employment?.incomeAmountCents);
  const frequency = String(employment?.incomeFrequency || "monthly").trim().toLowerCase();
  if (incomeAmountCents == null || incomeAmountCents <= 0) return coApplicantIncome || null;

  const primary =
    frequency === "annual"
      ? Math.round((incomeAmountCents / 100) / 12)
      : Math.round(incomeAmountCents / 100);
  return primary + coApplicantIncome;
}

function toEmploymentMonths(application: any): number | null {
  return (
    numberOrNull(application?.applicantProfile?.employment?.monthsAtJob) ??
    numberOrNull(application?.employment?.monthsAtJob) ??
    numberOrNull(application?.employmentMonths)
  );
}

function toCoTenantCount(application: any): number {
  const explicit = numberOrNull(application?.coTenantCount);
  if (explicit != null && explicit > 0) return explicit;
  return application?.coApplicant ? 2 : 1;
}

function deriveIdentityStatus(application: any, screeningResult: any): RiskAgentIdentityStatus {
  if (screeningResult?.identityVerified === true) return "verified";

  const summaryFlags = Array.isArray(application?.screeningResultSummary?.flags)
    ? application.screeningResultSummary.flags.map((value: unknown) => String(value || "").toLowerCase())
    : [];
  if (summaryFlags.some((flag: string) => flag.includes("identity") && flag.includes("recheck"))) {
    return "needs_review";
  }

  const screeningStatus = String(application?.screeningStatus || screeningResult?.status || "").trim().toLowerCase();
  if (["complete", "completed"].includes(screeningStatus)) return "pending";
  if (["processing", "paid", "external_pending", "requested", "in_progress"].includes(screeningStatus)) return "pending";
  if (["failed", "manual_review_required", "inconclusive"].includes(screeningStatus)) return "needs_review";
  if (screeningStatus) return "missing";
  return "unknown";
}

function deriveDocumentStatus(application: any, reviewSummary: ReturnType<typeof buildReviewSummary>): RiskAgentDocumentStatus {
  const checklist = Array.isArray(application?.documentChecklist) ? application.documentChecklist : [];
  if (checklist.length) {
    const statuses = checklist.map((entry: any) => String(entry?.status || "").trim().toLowerCase());
    if (statuses.some((status: string) => status === "needs_review" || status === "manual_review_required")) return "needs_review";
    if (statuses.some((status: string) => status === "missing")) return "missing";
    if (statuses.some((status: string) => status === "pending" || status === "uploaded" || status === "submitted")) return "pending";
    return "verified";
  }

  const missingSteps = Array.isArray(application?.missingSteps) ? application.missingSteps.filter(Boolean) : [];
  if (missingSteps.length) return "missing";

  const reviewFlags = Array.isArray(reviewSummary?.derived?.flags) ? reviewSummary.derived.flags : [];
  const criticalFlags = reviewFlags.filter((flag: string) =>
    ["MISSING_SIGNATURE", "MISSING_APPLICATION_CONSENT", "MISSING_INCOME", "MISSING_WORK_REFERENCE_PHONE"].includes(flag)
  );

  const uploadedDocsCount = Array.isArray(application?.documents)
    ? application.documents.length
    : Array.isArray(application?.documentRefs)
    ? application.documentRefs.length
    : 0;

  if (criticalFlags.length) return uploadedDocsCount > 0 ? "pending" : "missing";
  if (uploadedDocsCount > 0) return "pending";
  if ((reviewSummary?.derived?.completeness?.score || 0) >= 0.9) return "verified";
  return "unknown";
}

function deriveLeaseApplicationConsistency(application: any, lease: any): RiskAgentConsistencyStatus {
  if (!lease) return "unknown";
  const applicationPropertyId = asString(application?.propertyId);
  const leasePropertyId = asString(lease?.propertyId);
  if (applicationPropertyId && leasePropertyId && applicationPropertyId !== leasePropertyId) return "conflict";

  const applicationTenantId = asString(application?.tenantId || application?.convertedTenantId);
  const leaseTenantIds = [
    asString(lease?.tenantId),
    ...(Array.isArray(lease?.tenantIds) ? lease.tenantIds.map((value: unknown) => asString(value)) : []),
  ].filter(Boolean);
  if (applicationTenantId && leaseTenantIds.length && !leaseTenantIds.includes(applicationTenantId)) return "conflict";
  return "aligned";
}

async function loadDoc(collectionName: string, id: string | null) {
  const docId = asString(id);
  if (!docId) return null;
  const snap = await db.collection(collectionName).doc(docId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

async function loadScreeningResult(application: any) {
  const byId = await loadDoc("screeningResults", asString(application?.screeningResultId));
  if (byId) return byId;
  return null;
}

async function loadLease(application: any) {
  const direct = await loadDoc("leases", asString(application?.leaseId));
  if (direct) return direct;

  const tenantId = asString(application?.tenantId || application?.convertedTenantId);
  if (!tenantId) return null;

  const candidates = await Promise.all([
    db.collection("leases").where("tenantId", "==", tenantId).limit(10).get().catch(() => ({ docs: [] } as any)),
    db.collection("leases").where("tenantIds", "array-contains", tenantId).limit(10).get().catch(() => ({ docs: [] } as any)),
  ]);

  for (const result of candidates) {
    const first = result.docs?.[0];
    if (first) return { id: first.id, ...(first.data() as any) };
  }

  return null;
}

async function buildPaymentHistory(landlordId: string | null, tenantId: string | null) {
  if (!landlordId || !tenantId) {
    return { paymentHistoryRatio: null, latePayments: null };
  }

  let paymentCount = 0;
  try {
    const paymentSnap = await db.collection("payments").where("tenantId", "==", tenantId).limit(24).get();
    paymentCount = paymentSnap.docs?.length || 0;
  } catch {
    paymentCount = 0;
  }

  try {
    const ledger = await listLedgerEventsV2({ landlordId, tenantId, limit: 50 });
    const signals = computeTenantSignals(ledger.items || [], tenantId, landlordId);
    const latePayments = numberOrNull(signals?.latePaymentsCount) || 0;
    const paymentHistoryRatio =
      paymentCount + latePayments > 0 ? Number((paymentCount / (paymentCount + latePayments)).toFixed(2)) : null;
    return {
      paymentHistoryRatio,
      latePayments: latePayments > 0 ? latePayments : null,
    };
  } catch {
    return { paymentHistoryRatio: null, latePayments: null };
  }
}

async function buildApplicationRiskContext(applicationId: string): Promise<RiskAgentApplicationContext> {
  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) {
    const error = new Error("NOT_FOUND") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const application = { id: snap.id, ...(snap.data() as any) };
  const landlordId = asString(application?.landlordId);
  const propertyId = asString(application?.propertyId);
  const tenantId = asString(application?.tenantId || application?.convertedTenantId);
  const leaseId = asString(application?.leaseId);
  const reviewSummary = buildReviewSummary(applicationId, application);
  const [screeningResult, lease] = await Promise.all([loadScreeningResult(application), loadLease(application)]);
  const paymentHistory = await buildPaymentHistory(landlordId, tenantId);

  return {
    applicationId,
    application,
    landlordId,
    propertyId,
    tenantId,
    leaseId: asString(lease?.id || leaseId),
    identityStatus: deriveIdentityStatus(application, screeningResult),
    documentStatus: deriveDocumentStatus(application, reviewSummary),
    monthlyIncome: toMonthlyIncome(application),
    monthlyRent:
      numberOrNull(application?.requestedRent) ??
      numberOrNull(application?.monthlyRent) ??
      (numberOrNull(application?.applicantProfile?.currentRentAmountCents) != null
        ? Math.round(Number(application.applicantProfile.currentRentAmountCents) / 100)
        : null),
    employmentMonths: toEmploymentMonths(application),
    coTenantCount: toCoTenantCount(application),
    applicationCompleteness: numberOrNull(reviewSummary?.derived?.completeness?.score),
    paymentHistoryRatio: paymentHistory.paymentHistoryRatio,
    latePayments: paymentHistory.latePayments,
    leaseApplicationConsistency: deriveLeaseApplicationConsistency(application, lease),
    reviewSummarySnapshot: {
      screeningStatus: asString(application?.screeningStatus),
      screeningProvider: asString(application?.screeningProvider),
      screeningScoreBand: asString(application?.screeningResultSummary?.scoreBand),
      applicationStatus: asString(application?.status),
    },
  };
}

export async function evaluateApplicationRisk(params: { applicationId: string }): Promise<{
  run: RiskAgentRunRecord;
  latest: RiskAgentLatestRecord;
  evaluation: RiskAgentEvaluation;
}> {
  const context = await buildApplicationRiskContext(params.applicationId);
  const evaluation = evaluateRiskAgentContext(context);
  const persisted = await persistRiskAgentRun({
    entityType: "application",
    entityId: params.applicationId,
    applicationId: params.applicationId,
    landlordId: context.landlordId,
    propertyId: context.propertyId,
    tenantId: context.tenantId,
    leaseId: context.leaseId,
    reviewSummarySnapshot: context.reviewSummarySnapshot,
    evaluation,
  });

  return {
    run: persisted.run,
    latest: persisted.latest,
    evaluation,
  };
}

export async function getLatestApplicationRisk(params: { applicationId: string }): Promise<RiskAgentLatestRecord | null> {
  return loadLatestRiskAgentResult("application", params.applicationId);
}
