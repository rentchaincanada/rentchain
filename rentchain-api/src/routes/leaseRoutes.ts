import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { recordPdfExportTelemetry } from "../lib/pdfExportObservability/recordPdfExportTelemetry";
import {
  CreateLeasePayload,
  leaseService,
  UpdateLeasePayload,
} from "../services/leaseService";
import { requireCapability } from "../services/capabilityGuard";
import { db } from "../config/firebase";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  applyPatch,
  generateScheduleA,
  getDraftById,
  getSnapshotById,
  NS_PROVINCE,
  NS_TEMPLATE_VERSION,
  validateCreateInput,
} from "../services/leaseDraftsService";
import {
  getLeaseAutomationTasks,
  regenerateLeaseAutomationTasks,
} from "../services/automationScheduler/leaseAutomationTaskStore";
import {
  CURRENT_LEASE_STATUSES,
  loadCanonicalPropertyLeases,
  loadUnitsForProperty,
  resolveUnitReference,
  toCanonicalLeaseRecord,
} from "../services/leaseCanonicalizationService";
import { evaluateSameLeaseAgreement, groupLeaseAgreementCandidates, pickAgreementWinner } from "../services/leasePartyConsolidationService";
import { loadPropertyLeaseIntegrityDiagnostics } from "../services/leaseIntegrityService";
import { buildLeaseRiskPersistenceFields, computeLeaseRiskSnapshot } from "../services/risk/recomputeLeaseRisk";
import { loadPropertyCredibilitySummary } from "../services/risk/propertyCredibilitySummary";
import { dedupePropertyScopedLeasesByUnit, filterPropertyScopedLeases } from "../services/risk/propertyLeaseIsolation";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";
import {
  resolvePaymentIntentByRentPaymentId,
} from "../lib/payments/paymentIntentResolver";
import {
  buildPaymentObligationLedgerRows,
  summarizePaymentObligationLedger,
} from "../lib/payments/paymentObligationLedger";
import {
  deriveDelinquencySignals,
  summarizeDelinquencySignals,
} from "../lib/payments/delinquencySignals";
import { deriveDecisions } from "../lib/decisions/decisionEngine";
import {
  applyDecisionActions,
  DECISION_ACTIONS_COLLECTION,
} from "../lib/decisions/decisionActions";
import {
  isTargetedHiddenLeaseId,
  isTargetedHiddenTenantId,
} from "../lib/testDataVisibilityTargets";
import {
  enableRentCollectionForLease,
  type RentPaymentRecord,
} from "../services/rentPayments/rentPaymentService";
import { buildLeasePaymentProjection } from "../services/projections/buildLeasePaymentProjection";
import { computeNoResponseState } from "../services/leaseNoticeWorkflowService";
import { deriveLeaseLifecycleSummary } from "../services/leaseLifecycle/deriveLeaseLifecycleSummary";
import { deriveLeaseLifecycleState } from "../lib/leases/leaseLifecycle";
import { syncPropertyUnitOccupancyForTenantContext } from "../services/tenantPortal/tenantOccupancySyncService";

const router = Router();
const LEDGER_COLLECTION = "ledgerEntries";
const LEASE_NOTES_COLLECTION = "leaseNotes";
const PAYMENT_METHODS = new Set(["cash", "etransfer", "cheque", "bank", "card", "other"]);
const CHARGE_CATEGORIES = new Set(["rent", "fee", "adjustment"]);

type LedgerEntryType = "charge" | "payment" | "adjustment";
type ReconciliationPropertyState = {
  propertyName: string;
  isArchived: boolean;
  hiddenFromActiveLists: boolean;
};

function toIsoDate(input: unknown): string | null {
  const value = String(input || "").trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function cents(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizePortfolioStatus(value: unknown): "active" | "archived" {
  return normalizeStatus(value) === "archived" ? "archived" : "active";
}

function normalizePhoneDigits(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 15);
  return digits || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
}

async function loadTenantNotificationContext(tenantId: string, landlordId: string) {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return null;
  const tenantSnap = await db.collection("tenants").doc(normalizedTenantId).get().catch(() => null);
  if (!tenantSnap?.exists) return null;
  const tenant = (tenantSnap.data() as any) || {};
  const tenantLandlordId = String(tenant?.landlordId || "").trim();
  if (tenantLandlordId && landlordId && tenantLandlordId !== landlordId) return null;
  return {
    tenantId: normalizedTenantId,
    tenantName: String(tenant?.fullName || tenant?.name || "").trim() || null,
    tenantEmail: String(tenant?.email || "").trim().toLowerCase() || null,
  };
}

async function sendLeaseAvailableEmail(params: {
  leaseId: string;
  tenantId: string;
  landlordId: string;
  tenantEmail?: string | null;
  tenantName?: string | null;
  propertyLabel?: string | null;
  unitLabel?: string | null;
  startDate?: string | null;
}) {
  const tenantContext = params.tenantEmail
    ? {
        tenantId: params.tenantId,
        tenantName: params.tenantName || null,
        tenantEmail: params.tenantEmail,
      }
    : await loadTenantNotificationContext(params.tenantId, params.landlordId);
  const tenantEmail = String(tenantContext?.tenantEmail || "").trim().toLowerCase();
  if (!EMAIL_RE.test(tenantEmail)) {
    return { attempted: false, sent: false, reason: "tenant_email_missing" };
  }
  const from = String(process.env.LEASE_EMAIL_FROM || process.env.EMAIL_FROM || process.env.FROM_EMAIL || "").trim();
  if (!from) {
    return { attempted: false, sent: false, reason: "email_from_missing" };
  }

  const contextParts = [params.propertyLabel, params.unitLabel, params.startDate ? `Start date: ${params.startDate}` : null]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const intro = [
    tenantContext?.tenantName ? `Hi ${tenantContext.tenantName},` : "Hi,",
    "A lease is available in your RentChain tenant portal.",
    contextParts.length ? contextParts.join("\n") : null,
  ].filter(Boolean).join("\n\n");

  try {
    await sendEmail({
      to: tenantEmail,
      from,
      replyTo: from,
      subject: "Lease available in RentChain",
      text: buildEmailText({
        intro,
        ctaText: "View lease",
        ctaUrl: `${publicAppUrl()}/tenant/lease`,
      }),
      html: buildEmailHtml({
        title: "Lease available",
        intro,
        ctaText: "View lease",
        ctaUrl: `${publicAppUrl()}/tenant/lease`,
      }),
    });
    return { attempted: true, sent: true };
  } catch (err: any) {
    console.error("[lease-created] tenant email send failed", {
      leaseId: params.leaseId,
      tenantId: params.tenantId,
      errMessage: err?.message,
    });
    return { attempted: true, sent: false, reason: err?.message || "send_failed" };
  }
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

async function getLeaseForLandlord(leaseId: string, landlordId: string) {
  const leaseSnap = await db.collection("leases").doc(leaseId).get();
  if (!leaseSnap.exists) return { ok: false as const, status: 404, error: "Lease not found" };
  const lease = leaseSnap.data() as any;
  if (String(lease?.landlordId || "").trim() !== landlordId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, lease };
}

async function getLeaseEntityForLandlord(leaseId: string, landlordId: string) {
  const firestoreResult = await getLeaseForLandlord(leaseId, landlordId);
  if (firestoreResult.ok) {
    return { ok: true as const, source: "firestore" as const, lease: firestoreResult.lease };
  }

  if (firestoreResult.status === 403) {
    return firestoreResult;
  }

  const memoryLease = leaseService.getById(leaseId);
  if (!memoryLease) {
    return firestoreResult;
  }
  return { ok: true as const, source: "memory" as const, lease: memoryLease as any };
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") {
    try {
      return Number(value.toMillis()) || 0;
    } catch {
      return 0;
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeaseRow(id: string, raw: any) {
  const risk = raw?.risk && typeof raw?.risk === "object" ? raw.risk : null;
  const lifecycle = deriveLeaseLifecycleState({ id, ...raw });
  return {
    id,
    landlordId: String(raw?.landlordId || "").trim() || null,
    tenantId: String(raw?.tenantId || raw?.primaryTenantId || raw?.tenantIds?.[0] || "").trim(),
    tenantIds: Array.isArray(raw?.tenantIds)
      ? raw.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : String(raw?.tenantId || raw?.primaryTenantId || "").trim()
      ? [String(raw?.tenantId || raw?.primaryTenantId || "").trim()]
      : [],
    primaryTenantId: String(raw?.primaryTenantId || raw?.tenantId || raw?.tenantIds?.[0] || "").trim() || null,
    propertyId: String(raw?.propertyId || "").trim(),
    unitId: String(raw?.unitId || "").trim() || null,
    unitNumber: String(raw?.unitNumber || raw?.unitId || raw?.unit || "").trim(),
    monthlyRent:
      typeof raw?.monthlyRent === "number"
        ? raw.monthlyRent
        : typeof raw?.currentRent === "number"
        ? raw.currentRent
        : typeof raw?.rent === "number"
        ? raw.rent
        : 0,
    startDate: String(raw?.startDate || raw?.leaseStartDate || raw?.leaseStart || "").trim(),
    endDate:
      raw?.endDate == null && raw?.leaseEndDate == null && raw?.leaseEnd == null
        ? null
        : String(raw?.endDate || raw?.leaseEndDate || raw?.leaseEnd || "").trim() || null,
    status: String(raw?.status || "active").trim().toLowerCase() || "active",
    risk,
    riskScore: typeof raw?.riskScore === "number" ? raw.riskScore : typeof risk?.score === "number" ? risk.score : null,
    riskGrade: String(raw?.riskGrade || risk?.grade || "").trim() || null,
    riskConfidence:
      typeof raw?.riskConfidence === "number"
        ? raw.riskConfidence
        : typeof risk?.confidence === "number"
        ? risk.confidence
        : null,
    riskTimeline: Array.isArray(raw?.riskTimeline) ? raw.riskTimeline : [],
    hiddenFromActiveLists: raw?.hiddenFromActiveLists === true,
    cleanupReason: String(raw?.cleanupReason || "").trim() || null,
    cleanupBatch: String(raw?.cleanupBatch || "").trim() || null,
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
    derivedLifecycleState: lifecycle.state,
    derivedLifecycleReasons: lifecycle.reasons,
    derivedLifecycleRequiresReview: lifecycle.requiresReview,
    derivedLifecycleIsCurrent: lifecycle.isCurrent,
    derivedLifecycleIsOccupancyActive: lifecycle.isOccupancyActive,
  };
}

function mergeLeaseRows(rows: any[]) {
  const byId = new Map<string, any>();
  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(String(row.id), row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const updatedDiff = toMillis(b?.updatedAt) - toMillis(a?.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return toMillis(b?.createdAt) - toMillis(a?.createdAt);
  });
}

function isCurrentLeaseStatus(status: unknown): boolean {
  return CURRENT_LEASE_STATUSES.has(String(status || "").trim().toLowerCase());
}

function isHiddenFromLandlordLeaseLists(row: any): boolean {
  return row?.hiddenFromActiveLists === true || isTargetedHiddenLeaseId(row?.id);
}

function resolveUnitOccupancyStatus(unit: any): "occupied" | "vacant" | null {
  const explicitStatus = normalizeStatus(unit?.status);
  if (explicitStatus === "occupied" || explicitStatus === "vacant") {
    return explicitStatus;
  }

  const occupancyStatus = normalizeStatus(unit?.occupancyStatus);
  if (occupancyStatus === "occupied" || occupancyStatus === "vacant") {
    return occupancyStatus;
  }

  return null;
}

function propertyUnitKeyById(propertyId: string, unitId: string) {
  return `${propertyId}::id::${unitId}`;
}

function propertyUnitKeyByNumber(propertyId: string, unitNumber: string) {
  return `${propertyId}::num::${unitNumber}`;
}

function normalizeUnitReference(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeUnitMatchToken(value: any): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^unit\b/, "").replace(/[\s_-]+/g, "");
}

async function resolvePropertyUnitForLease(lease: any, errorPrefix: string) {
  const propertyId = String(lease?.propertyId || "").trim();
  const unitId = String(lease?.unitId || "").trim();
  const unitNumber = String(lease?.unitNumber || lease?.unit || "").trim();
  if (!propertyId) {
    const error = new Error(`${errorPrefix}_property_not_found`);
    (error as any).code = `${errorPrefix}_property_not_found`;
    throw error;
  }

  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    const error = new Error(`${errorPrefix}_property_not_found`);
    (error as any).code = `${errorPrefix}_property_not_found`;
    throw error;
  }

  const propertyData = (propertySnap.data() || {}) as any;
  const units = Array.isArray(propertyData?.units) ? propertyData.units : [];
  if (!units.length) {
    const error = new Error(`${errorPrefix}_unit_not_found`);
    (error as any).code = `${errorPrefix}_unit_not_found`;
    throw error;
  }

  const normalizedUnitId = normalizeUnitReference(unitId);
  const normalizedUnitNumber = normalizeUnitReference(unitNumber);
  const unitIndex = units.findIndex((unit: any) => {
    const candidateUnitId = normalizeUnitReference(unit?.id || unit?.unitId);
    if (normalizedUnitId && candidateUnitId === normalizedUnitId) return true;
    const candidateUnitNumber = normalizeUnitReference(unit?.unitNumber || unit?.label || unit?.unit);
    return Boolean(normalizedUnitNumber) && candidateUnitNumber === normalizedUnitNumber;
  });

  if (unitIndex < 0) {
    const error = new Error(`${errorPrefix}_unit_not_found`);
    (error as any).code = `${errorPrefix}_unit_not_found`;
    throw error;
  }

  return {
    propertyRef,
    units,
    unitIndex,
  };
}

async function reconcilePropertyUnitVacancyForLeaseEnd(lease: any) {
  const { propertyRef, units, unitIndex } = await resolvePropertyUnitForLease(lease, "lease_end");
  const nowIso = new Date().toISOString();
  const nextUnits = units.map((unit: any, index: number) =>
    index === unitIndex ? { ...unit, status: "vacant" } : unit
  );
  await propertyRef.set(
    {
      units: nextUnits,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  const unitDocId = await resolveStandaloneUnitDocIdForLeaseEnd(lease);
  if (unitDocId) {
    await db.collection("units").doc(unitDocId).set(
      {
        status: "vacant",
        occupancyStatus: "vacant",
        tenantId: null,
        currentTenantId: null,
        leaseId: null,
        currentLeaseId: null,
        occupancySource: "lease_end",
        occupancyUpdatedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  }
}

async function resolveStandaloneUnitDocIdForLeaseEnd(lease: any): Promise<string | null> {
  const propertyId = String(lease?.propertyId || "").trim();
  const landlordId = String(lease?.landlordId || "").trim();
  if (!propertyId) return null;

  const canonicalUnits = await loadUnitsForProperty(db as any, propertyId, landlordId || null);
  const leaseUnitId = String(lease?.unitId || "").trim();
  const leaseUnitNumber = String(lease?.unitNumber || lease?.unit || "").trim();
  const byId = resolveUnitReference(canonicalUnits, leaseUnitId);
  if (byId.ambiguous) return null;
  if (byId.unit) return byId.unit.id;

  const byLabel = resolveUnitReference(canonicalUnits, leaseUnitNumber);
  if (byLabel.ambiguous) return null;
  return byLabel.unit?.id || null;
}

async function syncOccupancyAfterActiveLeaseWrite(
  input: {
    tenantId: string;
    leaseId: string;
    landlordId: string;
    propertyId: string;
    unitId: string;
  },
  logPrefix: string
) {
  try {
    const result = await syncPropertyUnitOccupancyForTenantContext(input);
    if (!result.updated) {
      console.warn(`${logPrefix} occupancy sync skipped`, {
        leaseId: input.leaseId,
        tenantId: input.tenantId,
        landlordId: input.landlordId,
        propertyId: input.propertyId,
        unitId: input.unitId,
        reason: result.reason,
      });
    }
  } catch (syncErr) {
    console.warn(`${logPrefix} occupancy sync failed`, syncErr);
  }
}

async function reconcilePropertyUnitOccupancyForLeaseRestore(lease: any) {
  const targets = await resolveRestoreUnitTargetsForLease(lease, "lease_restore");
  const nowIso = new Date().toISOString();

  await db.collection("units").doc(targets.unitDocId).set(
    {
      status: "occupied",
      occupancyStatus: "occupied",
      updatedAt: nowIso,
    },
    { merge: true }
  );

  const propertyPatch: Record<string, unknown> = {
    updatedAt: nowIso,
  };
  if (targets.propertyUnitIndex >= 0) {
    propertyPatch.units = targets.propertyUnits.map((unit: any, index: number) =>
      index === targets.propertyUnitIndex ? { ...unit, status: "occupied" } : unit
    );
  }
  await targets.propertyRef.set(propertyPatch, { merge: true });
}

async function resolveRestoreUnitTargetsForLease(lease: any, errorPrefix: string) {
  const propertyId = String(lease?.propertyId || "").trim();
  const landlordId = String(lease?.landlordId || "").trim();
  const leaseUnitId = String(lease?.unitId || "").trim();
  const leaseUnitNumber = String(lease?.unitNumber || lease?.unit || "").trim();
  if (!propertyId) {
    const error = new Error(`${errorPrefix}_property_not_found`);
    (error as any).code = `${errorPrefix}_property_not_found`;
    throw error;
  }

  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    const error = new Error(`${errorPrefix}_property_not_found`);
    (error as any).code = `${errorPrefix}_property_not_found`;
    throw error;
  }

  const propertyData = (propertySnap.data() || {}) as any;
  const propertyUnits = Array.isArray(propertyData?.units) ? propertyData.units : [];
  const canonicalUnits = await loadUnitsForProperty(db as any, propertyId, landlordId || null);

  const normalizedLeaseUnitId = normalizeUnitReference(leaseUnitId);
  const canonicalIdMatches = normalizedLeaseUnitId
    ? canonicalUnits.filter((unit) => normalizeUnitReference(unit.id) === normalizedLeaseUnitId)
    : [];
  if (canonicalIdMatches.length > 1) {
    const error = new Error(`${errorPrefix}_unit_ambiguous`);
    (error as any).code = `${errorPrefix}_unit_ambiguous`;
    throw error;
  }

  const fallbackTarget = normalizeUnitMatchToken(leaseUnitNumber);
  const canonicalFallbackMatches =
    canonicalIdMatches.length === 1 || !fallbackTarget
      ? []
      : canonicalUnits.filter((unit) => {
          const tokens = [
            normalizeUnitMatchToken(unit.unitNumber),
            normalizeUnitMatchToken(unit.label),
            normalizeUnitMatchToken((unit.raw as any)?.unit),
            normalizeUnitMatchToken((unit.raw as any)?.name),
          ].filter(Boolean);
          return tokens.includes(fallbackTarget);
        });
  if (!canonicalIdMatches.length && canonicalFallbackMatches.length > 1) {
    const error = new Error(`${errorPrefix}_unit_ambiguous`);
    (error as any).code = `${errorPrefix}_unit_ambiguous`;
    throw error;
  }

  const matchedUnit = canonicalIdMatches[0] || canonicalFallbackMatches[0] || null;
  if (!matchedUnit) {
    const error = new Error(`${errorPrefix}_unit_not_found`);
    (error as any).code = `${errorPrefix}_unit_not_found`;
    throw error;
  }

  let propertyUnitIndex = -1;
  if (propertyUnits.length) {
    const embeddedIdMatches = leaseUnitId
      ? propertyUnits
          .map((unit: any, index: number) => ({ unit, index }))
          .filter(
            ({ unit }: { unit: any; index: number }) =>
              normalizeUnitReference(unit?.id || unit?.unitId) === normalizedLeaseUnitId
          )
      : [];
    if (embeddedIdMatches.length > 1) {
      const error = new Error(`${errorPrefix}_unit_ambiguous`);
      (error as any).code = `${errorPrefix}_unit_ambiguous`;
      throw error;
    }

    if (embeddedIdMatches.length === 1) {
      propertyUnitIndex = embeddedIdMatches[0].index;
    } else {
      const embeddedTarget = normalizeUnitMatchToken(
        matchedUnit.unitNumber || matchedUnit.label || leaseUnitNumber
      );
      if (embeddedTarget) {
        const embeddedLabelMatches = propertyUnits
          .map((unit: any, index: number) => ({ unit, index }))
          .filter(({ unit }: { unit: any; index: number }) => {
            const tokens = [
              normalizeUnitMatchToken(unit?.unitNumber),
              normalizeUnitMatchToken(unit?.label),
              normalizeUnitMatchToken(unit?.unit),
              normalizeUnitMatchToken(unit?.name),
            ].filter(Boolean);
            return tokens.includes(embeddedTarget);
          });
        if (embeddedLabelMatches.length > 1) {
          const error = new Error(`${errorPrefix}_unit_ambiguous`);
          (error as any).code = `${errorPrefix}_unit_ambiguous`;
          throw error;
        }
        propertyUnitIndex = embeddedLabelMatches[0]?.index ?? -1;
      }
    }
  }

  return {
    propertyRef,
    propertyUnits,
    propertyUnitIndex,
    unitDocId: matchedUnit.id,
  };
}

async function loadLeaseDocumentUrlForLease(raw: any): Promise<string | null> {
  const directUrl =
    String(raw?.documentUrl || raw?.approvedDocumentUrl || raw?.documentRef || "").trim() || null;
  if (directUrl) return directUrl;

  const referenceBucket = String(raw?.referenceDocument?.bucket || raw?.leaseDocument?.bucket || "").trim();
  const referencePath = String(raw?.referenceDocument?.path || raw?.leaseDocument?.path || "").trim();
  if (referenceBucket && referencePath) {
    try {
      return await getSignedDownloadUrl({ bucket: referenceBucket, path: referencePath, expiresMinutes: 30 });
    } catch {
      return null;
    }
  }

  const draftId = String(raw?.sourceDraftId || "").trim();
  if (!draftId) return null;

  try {
    const draftSnap = await db.collection("leaseDrafts").doc(draftId).get();
    if (!draftSnap.exists) return null;
    const draft = draftSnap.data() as any;
    const snapshotId = String(draft?.lastGeneratedSnapshotId || "").trim();
    if (!snapshotId) return null;
    const snapshotSnap = await db.collection("leaseSnapshots").doc(snapshotId).get();
    if (!snapshotSnap.exists) return null;
    const snapshot = snapshotSnap.data() as any;
    const generatedFiles = Array.isArray(snapshot?.generatedFiles) ? snapshot.generatedFiles : [];
    const firstFile = generatedFiles.find((item: any) => String(item?.url || "").trim());
    return String(firstFile?.url || "").trim() || null;
  } catch {
    return null;
  }
}

function firstGeneratedLeasePdfFile(generatedFiles: any[]): any | null {
  return (
    (Array.isArray(generatedFiles) ? generatedFiles : []).find((item: any) => {
      const url = String(item?.url || "").trim();
      const kind = String(item?.kind || "").trim().toLowerCase();
      return url.startsWith("https://") && (!kind || kind.includes("pdf") || kind.includes("schedule"));
    }) || null
  );
}

type GeneratedLeaseDocument = {
  url: string;
  snapshotId: string | null;
  file: any;
};

async function loadGeneratedLeaseDocumentForDraft(draftId: string, draft: any): Promise<GeneratedLeaseDocument | null> {
  const normalizedDraftId = String(draftId || "").trim();
  if (!normalizedDraftId) return null;

  const candidates: Array<GeneratedLeaseDocument & { generatedAt: number }> = [];
  const seenSnapshotIds = new Set<string>();

  const addCandidate = (snapshotId: string | null, file: any, generatedAt: number) => {
    const leaseFile = firstGeneratedLeasePdfFile([file]);
    const url = String(leaseFile?.url || "").trim();
    if (!url.startsWith("https://")) return;
    candidates.push({
      url,
      snapshotId: snapshotId || null,
      file: leaseFile,
      generatedAt: Number(generatedAt || 0) || 0,
    });
  };

  const loadSnapshot = async (snapshotId: string | null) => {
    const normalizedSnapshotId = String(snapshotId || "").trim();
    if (!normalizedSnapshotId || seenSnapshotIds.has(normalizedSnapshotId)) return;
    seenSnapshotIds.add(normalizedSnapshotId);
    const snapshotSnap = await db.collection("leaseSnapshots").doc(normalizedSnapshotId).get().catch(() => null as any);
    if (!snapshotSnap?.exists) return;
    const snapshot = (snapshotSnap.data() as any) || {};
    const generatedFiles = Array.isArray(snapshot?.generatedFiles) ? snapshot.generatedFiles : [];
    const leaseFile = firstGeneratedLeasePdfFile(generatedFiles);
    if (!leaseFile) return;
    addCandidate(
      normalizedSnapshotId,
      leaseFile,
      Number(snapshot?.generatedAt || snapshot?.createdAt || snapshot?.updatedAt || 0)
    );
  };

  await loadSnapshot(String(draft?.lastGeneratedSnapshotId || "").trim() || null);
  await loadSnapshot(String(draft?.latestLeaseSnapshotId || "").trim() || null);

  const directUrl = String(draft?.lastGeneratedDocumentUrl || draft?.documentUrl || draft?.approvedDocumentUrl || draft?.documentRef || "").trim();
  if (directUrl.startsWith("https://")) {
    addCandidate(
      String(draft?.lastGeneratedSnapshotId || draft?.latestLeaseSnapshotId || "").trim() || null,
      { kind: "schedule-a-pdf", url: directUrl },
      Number(draft?.generatedAt || draft?.updatedAt || draft?.createdAt || 0)
    );
  }

  const queryGeneratedSnapshots = async (field: string) => {
    const snap = await db.collection("leaseSnapshots").where(field, "==", normalizedDraftId).get().catch(() => null as any);
    const docs = Array.isArray(snap?.docs) ? snap.docs : [];
    for (const doc of docs) {
      if (!doc?.id || seenSnapshotIds.has(doc.id)) continue;
      seenSnapshotIds.add(doc.id);
      const snapshot = (doc.data() as any) || {};
      const leaseFile = firstGeneratedLeasePdfFile(Array.isArray(snapshot?.generatedFiles) ? snapshot.generatedFiles : []);
      if (!leaseFile) continue;
      addCandidate(
        doc.id,
        leaseFile,
        Number(snapshot?.generatedAt || snapshot?.createdAt || snapshot?.updatedAt || 0)
      );
    }
  };

  await queryGeneratedSnapshots("sourceDraftId");
  await queryGeneratedSnapshots("draftId");

  candidates.sort((left, right) => right.generatedAt - left.generatedAt);
  const latest = candidates[0];
  if (!latest) return null;
  return {
    url: latest.url,
    snapshotId: latest.snapshotId,
    file: latest.file,
  };
}

function safeAttachmentDocumentId(parts: string[]) {
  return parts
    .map((part) => String(part || "").trim().replace(/[^A-Za-z0-9_-]+/g, "_"))
    .filter(Boolean)
    .join("_")
    .slice(0, 240);
}

function isVisibleLeaseAttachment(raw: any): boolean {
  const category = String(raw?.category || "").trim().toLowerCase();
  const purpose = String(raw?.purpose || "").trim().toUpperCase();
  const purposeLabel = String(raw?.purposeLabel || "").trim().toLowerCase();
  const title = String(raw?.title || "").trim().toLowerCase();
  return category === "lease" || purpose === "LEASE" || purposeLabel === "lease" || title === "lease document";
}

async function resolveLeaseAttachmentRef(params: {
  tenantId: string;
  leaseId: string | null;
  draftId: string;
  url: string;
}) {
  const tenantId = String(params.tenantId || "").trim();
  const leaseId = String(params.leaseId || "").trim();
  const draftId = String(params.draftId || "").trim();
  const url = String(params.url || "").trim();

  const existingSnap = await db
    .collection("ledgerAttachments")
    .where("tenantId", "==", tenantId)
    .limit(50)
    .get()
    .catch(() => null as any);

  const existingDocs = Array.isArray(existingSnap?.docs) ? existingSnap.docs : [];
  const matchingDoc = existingDocs.find((doc: any) => {
    const data = (doc.data() as any) || {};
    if (!isVisibleLeaseAttachment(data)) return false;
    const candidateLeaseId = String(data?.leaseId || "").trim();
    const candidateDraftId = String(data?.draftId || "").trim();
    const candidateLedgerItemId = String(data?.ledgerItemId || "").trim();
    const candidateUrl = String(data?.url || "").trim();
    if (leaseId && candidateLeaseId === leaseId) return true;
    if (leaseId && candidateLedgerItemId === leaseId) return true;
    if (draftId && candidateDraftId === draftId) return true;
    if (url && candidateUrl === url) return true;
    return false;
  });

  if (matchingDoc?.id) {
    return db.collection("ledgerAttachments").doc(matchingDoc.id);
  }

  const attachmentId = safeAttachmentDocumentId([
    "lease",
    tenantId,
    leaseId || draftId,
    "LEASE",
  ]);
  return db.collection("ledgerAttachments").doc(attachmentId);
}

async function linkGeneratedLeasePdfToTenantWorkspace(params: {
  draft: any;
  draftId: string;
  landlordId: string;
  snapshotId: string;
  file: any;
  actorId: string | null;
}) {
  const url = String(params.file?.url || "").trim();
  if (!url.startsWith("https://")) return;

  const leaseId = String(params.draft?.leaseId || "").trim() || null;
  const propertyId = String(params.draft?.propertyId || "").trim() || null;
  const unitId = String(params.draft?.unitId || "").trim() || null;
  const tenantIds = Array.isArray(params.draft?.tenantIds)
    ? params.draft.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
    : [];
  const now = Date.now();
  const fileName = "schedule-a-v1.pdf";

  if (leaseId) {
    await db
      .collection("leases")
      .doc(leaseId)
      .set(
        {
          documentUrl: url,
          approvedDocumentUrl: url,
          documentRef: url,
          documentGeneratedAt: now,
          leaseDocumentGeneratedAt: now,
          latestLeaseSnapshotId: params.snapshotId,
          updatedAt: now,
        },
        { merge: true }
      );
  }

  await Promise.all(
    tenantIds.map(async (tenantId: string) => {
      const attachmentRef = await resolveLeaseAttachmentRef({
        tenantId,
        leaseId,
        draftId: params.draftId,
        url,
      });
      await attachmentRef.set(
        {
          landlordId: params.landlordId,
          tenantId,
          leaseId,
          draftId: params.draftId,
          leaseSnapshotId: params.snapshotId,
          propertyId,
          unitId,
          ledgerItemId: leaseId || `leaseDraft:${params.draftId}`,
          url,
          title: "Lease document",
          fileName,
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          source: "lease_pdf_generation",
          generatedFileKind: String(params.file?.kind || "schedule-a-pdf"),
          sha256: String(params.file?.sha256 || "").trim() || null,
          sizeBytes: Number(params.file?.sizeBytes || 0) || null,
          createdAt: now,
          createdBy: params.actorId,
        },
        { merge: true }
      );
    })
  );
}

async function loadUnitLeaseDocumentForResponse(raw: any) {
  const leaseDocument = raw?.leaseDocument;
  if (!leaseDocument || typeof leaseDocument !== "object") return raw;
  const bucket = String(leaseDocument.bucket || "").trim();
  const path = String(leaseDocument.path || "").trim();
  if (!bucket || !path) return raw;
  try {
    const url = await getSignedDownloadUrl({ bucket, path, expiresMinutes: 30 });
    return {
      ...raw,
      leaseDocument: {
        ...leaseDocument,
        url,
      },
    };
  } catch {
    return raw;
  }
}

function getCanonicalUnitLabel(unit: any): string | null {
  const unitId = String(unit?.id || "").trim().toLowerCase();
  const candidates = [
    unit?.unitNumber,
    unit?.label,
    unit?.raw?.unitNumber,
    unit?.raw?.label,
    unit?.raw?.displayLabel,
    unit?.raw?.unitLabel,
    unit?.raw?.name,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return candidates.find((value) => value.toLowerCase() !== unitId) || candidates[0] || null;
}

async function resolveLeaseUnitSelection(input: {
  landlordId: string;
  propertyId: string;
  unitReference: string;
}): Promise<{ unitId: string; unitLabel: string }> {
  const units = await loadUnitsForProperty(db as any, input.propertyId, input.landlordId || null).catch(() => []);
  const resolution = resolveUnitReference(units, input.unitReference);
  if (!resolution.ambiguous && resolution.unit) {
    return {
      unitId: resolution.unit.id,
      unitLabel: getCanonicalUnitLabel(resolution.unit) || input.unitReference,
    };
  }
  return {
    unitId: input.unitReference,
    unitLabel: input.unitReference,
  };
}

async function hydrateLeaseUnitDisplayFields<T extends Record<string, any>>(
  lease: T,
  landlordId: string | null
): Promise<T> {
  const propertyId = String(lease?.propertyId || "").trim();
  const unitReference = String(lease?.unitId || lease?.unitNumber || lease?.unit || "").trim();
  if (!propertyId || !unitReference) return lease;
  const units = await loadUnitsForProperty(db as any, propertyId, landlordId || null).catch(() => []);
  const resolution = resolveUnitReference(units, unitReference);
  if (resolution.ambiguous || !resolution.unit) return lease;
  const unitLabel = getCanonicalUnitLabel(resolution.unit);
  if (!unitLabel) return lease;
  return {
    ...lease,
    unitId: String(lease?.unitId || resolution.unit.id || "").trim() || resolution.unit.id,
    unitNumber: unitLabel,
    unitLabel,
  };
}

function hydrateLeaseUnitDisplayFieldsFromUnits<T extends Record<string, any>>(
  lease: T,
  units: any[]
): T {
  const propertyId = String(lease?.propertyId || "").trim();
  const unitReference = String(lease?.unitId || lease?.unitNumber || lease?.unitLabel || lease?.unit || "").trim();
  if (!propertyId || !unitReference) return lease;
  const resolution = resolveUnitReference(units, unitReference);
  if (resolution.ambiguous || !resolution.unit) return lease;
  const unitLabel = getCanonicalUnitLabel(resolution.unit);
  if (!unitLabel) return lease;
  return {
    ...lease,
    unitId: String(lease?.unitId || resolution.unit.id || "").trim() || resolution.unit.id,
    unitNumber: unitLabel,
    unitLabel,
  };
}

async function enrichLeaseRow(raw: any) {
  const lease = normalizeLeaseRow(raw.id, raw);
  const propertyId = String(lease.propertyId || "").trim();
  const tenantId =
    String(lease.primaryTenantId || lease.tenantId || lease.tenantIds?.[0] || "").trim() || null;

  const [propertySnap, tenantSnap, documentUrl] = await Promise.all([
    propertyId ? db.collection("properties").doc(propertyId).get().catch(() => null) : Promise.resolve(null),
    tenantId ? db.collection("tenants").doc(tenantId).get().catch(() => null) : Promise.resolve(null),
    loadLeaseDocumentUrlForLease(raw),
  ]);

  const propertyName =
    propertySnap?.exists
      ? String(propertySnap.data()?.name || propertySnap.data()?.addressLine1 || "Property").trim() || "Property"
      : "Property";
  const tenantName =
    tenantSnap?.exists
      ? String(tenantSnap.data()?.fullName || tenantSnap.data()?.name || "").trim() || null
      : null;
  const tenantEmail =
    tenantSnap?.exists ? String(tenantSnap.data()?.email || "").trim() || null : null;
  const leasePaymentProjection = await buildLeasePaymentProjection({
    rawLease: raw,
    lease: {
      id: lease.id,
      landlordId: String(lease.landlordId || "").trim() || null,
      tenantId,
      primaryTenantId: String(lease.primaryTenantId || "").trim() || null,
      tenantIds: Array.isArray(lease.tenantIds) ? lease.tenantIds : [],
      propertyId,
      unitId: String(lease.unitId || "").trim() || null,
      unitNumber: String(lease.unitNumber || "").trim() || null,
      monthlyRent: lease.monthlyRent,
      startDate: lease.startDate,
      endDate: lease.endDate,
      status: lease.status,
    },
    leaseId: lease.id,
    documentUrl,
  });
  const leaseReadiness = leasePaymentProjection.leaseReadiness;
  const paymentReadiness = leasePaymentProjection.paymentReadiness;
  const rentPaymentSummary = leasePaymentProjection.rentPaymentSummary;

  return {
    ...(await hydrateLeaseUnitDisplayFields(lease, String(lease.landlordId || "").trim() || null)),
    propertyName,
    tenantName,
    tenantEmail,
    documentUrl,
    ...leaseReadiness,
    paymentReadiness,
    rentPaymentSummary,
    archivedAt: raw?.archivedAt || null,
    archivedByUserId: raw?.archivedByUserId || null,
    isArchived: Boolean(raw?.archivedAt),
  };
}

async function listLandlordLeaseRows(landlordId: string, opts?: { archived?: boolean | null }) {
  const collectionRef: any = (db as any).collection("leases");
  if (!collectionRef || typeof collectionRef.where !== "function") {
    return [];
  }

  const snap = await collectionRef.where("landlordId", "==", landlordId).get();
  const rows = (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
  const archivedFlag = opts?.archived;
  const filtered = rows.filter((row: any) => {
    if (isHiddenFromLandlordLeaseLists(row)) return false;
    const isArchived = Boolean(row?.archivedAt);
    if (archivedFlag === true) return isArchived;
    if (archivedFlag === false) return !isArchived && isCurrentLeaseStatus(row?.status);
    return true;
  });
  const rawLeaseById = new Map<string, any>(filtered.map((row: any) => [String(row?.id || "").trim(), row]));

  const leases = await Promise.all(filtered.map((row: any) => enrichLeaseRow(row)));
  const mergedLeases = mergeLeaseRows(leases);
  const leaseIds = mergedLeases.map((lease: any) => String(lease?.id || "").trim()).filter(Boolean);
  const latestNoticeByLeaseId = new Map<string, any>();
  if (leaseIds.length > 0) {
    const noticeSnap = await db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400).get().catch(() => null);
    const notices = (noticeSnap?.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((notice: any) => leaseIds.includes(String(notice?.leaseId || "").trim()))
      .sort((a: any, b: any) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    for (const notice of notices) {
      const leaseId = String(notice?.leaseId || "").trim();
      if (!leaseId || latestNoticeByLeaseId.has(leaseId)) continue;
      latestNoticeByLeaseId.set(leaseId, notice);
    }
  }

  return mergedLeases.map((lease: any) => {
    const rawLease = rawLeaseById.get(String(lease?.id || "").trim()) || null;
    const latestNotice = latestNoticeByLeaseId.get(String(lease?.id || "").trim()) || null;
    return {
      ...lease,
      leaseLifecycleSummary: deriveLeaseLifecycleSummary({
        lease: {
          status: lease?.status,
          leaseStartDate: lease?.startDate,
          leaseEndDate: lease?.endDate,
          nextNoticeDueAt: rawLease?.nextNoticeDueAt,
        },
        latestNotice,
        noResponse: latestNotice ? computeNoResponseState(latestNotice) : false,
      }),
    };
  });
}

async function listLeaseNotes(leaseId: string, landlordId: string) {
  const notesRef: any = (db as any).collection(LEASE_NOTES_COLLECTION);
  if (!notesRef || typeof notesRef.where !== "function") return [];
  const snap = await notesRef
    .where("landlordId", "==", landlordId)
    .where("leaseId", "==", leaseId)
    .get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
}


async function assertNoConflictingActiveAgreement(input: {
  leaseId?: string | null;
  excludeLeaseId?: string | null;
  landlordId: string;
  propertyId: string;
  unitId: string;
  tenantIds: string[];
  startDate?: string | null;
  endDate?: string | null;
  monthlyRent?: number | null;
}) {
  const units = await loadUnitsForProperty(db as any, input.propertyId, input.landlordId).catch(() => []);
  const candidateRaw = {
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantIds[0] || null,
    tenantIds: input.tenantIds,
    primaryTenantId: input.tenantIds[0] || null,
    status: "active",
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    monthlyRent: input.monthlyRent || null,
    currentRent: input.monthlyRent || null,
  };
  const candidate = {
    lease: toCanonicalLeaseRecord(input.leaseId || "__candidate__", candidateRaw as any, units),
    raw: candidateRaw as any,
  };
  const collectionRef: any = (db as any).collection("leases");
  if (!collectionRef || typeof collectionRef.where !== "function") {
    return [];
  }
  const snap = await collectionRef
    .where("landlordId", "==", input.landlordId)
    .where("propertyId", "==", input.propertyId)
    .get();
  const existing = snap.docs
    .filter((doc: any) => {
      const docId = String(doc.id || "");
      if (docId === String(input.leaseId || "")) return false;
      if (docId === String(input.excludeLeaseId || "")) return false;
      return true;
    })
    .map((doc: any) => ({ raw: doc.data() as any, lease: toCanonicalLeaseRecord(doc.id, doc.data() as any, units) }))
    .filter((entry: any) => CURRENT_LEASE_STATUSES.has(String(entry.lease.status || "").trim().toLowerCase()));

  return existing.filter((entry: any) => {
    const result = evaluateSameLeaseAgreement(candidate as any, entry as any);
    return result.decision === "merge" || result.decision === "ambiguous";
  });
}

async function findCurrentLeaseConflictsForUnit(input: {
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  unitNumber?: string | null;
  excludeLeaseId?: string | null;
}) {
  const collectionRef: any = (db as any).collection("leases");
  if (!collectionRef || typeof collectionRef.where !== "function") {
    return [];
  }

  const normalizedUnitId = normalizeUnitReference(input.unitId);
  const normalizedUnitNumber = normalizeUnitReference(input.unitNumber);
  const snap = await collectionRef
    .where("landlordId", "==", input.landlordId)
    .where("propertyId", "==", input.propertyId)
    .get();

  return snap.docs
    .map((doc: any) => ({ id: String(doc.id || "").trim(), ...(doc.data() as any) }))
    .filter((row: any) => row.id !== String(input.excludeLeaseId || ""))
    .filter((row: any) => CURRENT_LEASE_STATUSES.has(String(row?.status || "").trim().toLowerCase()))
    .filter((row: any) => {
      const candidateUnitId = normalizeUnitReference(row?.unitId);
      if (normalizedUnitId && candidateUnitId === normalizedUnitId) return true;
      const candidateUnitNumber = normalizeUnitReference(row?.unitNumber || row?.unit);
      return Boolean(normalizedUnitNumber) && candidateUnitNumber === normalizedUnitNumber;
    });
}

async function loadLedgerEntries(leaseId: string, landlordId: string, from?: string | null, to?: string | null) {
  const snap = await db
    .collection(LEDGER_COLLECTION)
    .where("landlordId", "==", landlordId)
    .where("leaseId", "==", leaseId)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((entry: any) => {
      const effectiveDate = String(entry?.effectiveDate || "").trim();
      if (from && effectiveDate && effectiveDate < from) return false;
      if (to && effectiveDate && effectiveDate > to) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const dateDiff = String(a?.effectiveDate || "").localeCompare(String(b?.effectiveDate || ""));
      if (dateDiff !== 0) return dateDiff;
      return toMillis(a?.createdAt) - toMillis(b?.createdAt);
    });
}

type LeaseLedgerPaymentIntentLink = {
  rentPaymentId: string;
  paymentIntentId: string | null;
  paymentIntentStatus: string | null;
};

function getLedgerRentPaymentId(entry: any): string | null {
  const candidates = [entry?.rentPaymentId, entry?.reference, entry?.paymentId];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return null;
}

async function loadLeaseLedgerPaymentIntentLinks(
  leaseId: string,
  landlordId: string
): Promise<Map<string, LeaseLedgerPaymentIntentLink>> {
  const links = new Map<string, LeaseLedgerPaymentIntentLink>();
  const snap = await db
    .collection("rentPayments")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  for (const doc of snap?.docs || []) {
    const data = (doc.data() as any) || {};
    if (String(data?.landlordId || "").trim() !== landlordId) continue;
    const rentPaymentId = String(data?.id || data?.rentPaymentId || doc.id || "").trim();
    if (!rentPaymentId) continue;
    const resolved = await resolvePaymentIntentByRentPaymentId({ rentPaymentId }).catch(() => null);
    links.set(rentPaymentId, {
      rentPaymentId,
      paymentIntentId:
        String(data?.paymentIntentId || resolved?.paymentIntentId || "").trim() || null,
      paymentIntentStatus: String(resolved?.status || "").trim() || null,
    });
  }
  return links;
}

function normalizeLeaseRentAmountCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

async function loadLeaseRentPaymentsForObligationLedger(
  leaseId: string,
  landlordId: string
): Promise<RentPaymentRecord[]> {
  const snap = await db
    .collection("rentPayments")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => String(record?.landlordId || "").trim() === landlordId)
    .map((record: any) => ({
      id: String(record?.id || record?.rentPaymentId || "").trim() || String(record?.id || "").trim(),
      leaseId: String(record?.leaseId || "").trim(),
      tenantId: String(record?.tenantId || "").trim(),
      landlordId: String(record?.landlordId || "").trim(),
      propertyId: String(record?.propertyId || "").trim() || null,
      unitId: String(record?.unitId || "").trim() || null,
      paymentIntentId: String(record?.paymentIntentId || "").trim() || null,
      amountCents: Math.max(0, Math.round(Number(record?.amountCents || 0))),
      currency: "cad" as const,
      status: String(record?.status || "setup_required").trim() as RentPaymentRecord["status"],
      processor: "stripe" as const,
      processorCheckoutSessionId: String(record?.processorCheckoutSessionId || "").trim() || null,
      processorPaymentIntentId: String(record?.processorPaymentIntentId || "").trim() || null,
      createdAt: String(record?.createdAt || "").trim(),
      updatedAt: String(record?.updatedAt || "").trim(),
      paidAt: String(record?.paidAt || "").trim() || null,
    }));
}

async function loadLeasePaymentIntentsForObligationLedger(leaseId: string, landlordId: string) {
  const snap = await db
    .collection("paymentIntents")
    .where("leaseId", "==", leaseId)
    .get()
    .catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ paymentIntentId: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => String(record?.landlordId || "").trim() === landlordId);
}

async function loadLeaseReconciliationRecordsForObligationLedger(params: {
  leaseId: string;
  paymentIntentIds: string[];
  rentPaymentIds: string[];
}) {
  const records = new Map<string, any>();
  async function collect(field: string, value: string) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) return;
    const snap = await db
      .collection("paymentReconciliationRecords")
      .where(field, "==", normalizedValue)
      .get()
      .catch(() => null);
    for (const doc of snap?.docs || []) {
      records.set(doc.id, { reconciliationId: doc.id, ...((doc.data() as any) || {}) });
    }
  }

  await collect("leaseId", params.leaseId);
  await collect("subjectId", params.leaseId);
  for (const paymentIntentId of params.paymentIntentIds) {
    await collect("paymentIntentId", paymentIntentId);
  }
  for (const rentPaymentId of params.rentPaymentIds) {
    await collect("rentPaymentId", rentPaymentId);
    await collect("subjectId", rentPaymentId);
  }
  return Array.from(records.values());
}

async function loadLeaseDecisionActions(leaseId: string) {
  const snap = await db.collection(DECISION_ACTIONS_COLLECTION).where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function enrichLeaseLedgerEntryWithPaymentIntent(
  entry: any,
  links: Map<string, LeaseLedgerPaymentIntentLink>
) {
  if (entry?.entryType !== "payment") return entry;
  const rentPaymentId = getLedgerRentPaymentId(entry);
  if (!rentPaymentId) return entry;
  const link = links.get(rentPaymentId);
  if (!link) return { ...entry, rentPaymentId };
  return {
    ...entry,
    rentPaymentId,
    paymentIntentId: link.paymentIntentId,
    paymentIntentStatus: link.paymentIntentStatus,
  };
}

async function resolveLeaseLedgerExportLabels(lease: any) {
  const propertyId = String(lease?.propertyId || "").trim();
  const propertySnap = propertyId
    ? await db.collection("properties").doc(propertyId).get().catch(() => null)
    : null;
  const propertyData = propertySnap?.exists ? (propertySnap.data() as any) : null;
  const property =
    String(propertyData?.propertyAddress || lease?.propertyAddress || "").trim() ||
    String(propertyData?.addressLine1 || propertyData?.address || lease?.addressLine1 || lease?.address || "").trim() ||
    String(propertyData?.propertyName || lease?.propertyName || "").trim() ||
    String(propertyData?.name || lease?.name || "").trim() ||
    "Property";
  const unit =
    String(lease?.unitLabel || lease?.unitNumber || lease?.unit || "").trim() ||
    "Unit";
  return { property, unit };
}

function formatLedgerCurrency(centsValue: unknown): string {
  const centsNumber = Number(centsValue || 0);
  const negative = centsNumber < 0;
  const amount = Math.abs(centsNumber) / 100;
  return `${negative ? "-" : ""}$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function renderLeaseLedgerPdf(params: {
  leaseId: string;
  rows: any[];
  labels: { property: string; unit: string };
  from?: string | null;
  to?: string | null;
}) {
  const doc = new PDFDocument({ size: "LETTER", margin: 42 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const rangeLabel = [params.from, params.to].filter(Boolean).join(" to ") || "All dates";
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("Lease Ledger");
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor("#475569").text(`${params.labels.property} · Unit ${params.labels.unit}`);
  doc.text(`Lease ${params.leaseId} · ${rangeLabel} · ${params.rows.length} entries`);
  doc.moveDown(0.75);

  const tableX = 42;
  const tableWidth = 528;
  const columns = [
    { key: "date", label: "Date", width: tableWidth * 0.14, align: "left" as const },
    { key: "type", label: "Type", width: tableWidth * 0.16, align: "left" as const },
    { key: "description", label: "Description/Notes", width: tableWidth * 0.34, align: "left" as const },
    { key: "amount", label: "Amount", width: tableWidth * 0.17, align: "right" as const },
    { key: "balance", label: "Balance", width: tableWidth * 0.19, align: "right" as const },
  ];
  const rowPaddingX = 4;
  const rowPaddingY = 5;

  const drawHeader = () => {
    let x = tableX;
    const y = doc.y;
    doc.rect(tableX, y - 2, tableWidth, 18).fill("#f8fafc");
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a");
    columns.forEach((column) => {
      doc.text(column.label, x + rowPaddingX, y + 3, {
        width: column.width - rowPaddingX * 2,
        align: column.align,
        lineBreak: false,
      });
      x += column.width;
    });
    doc.y = y + 18;
    doc.strokeColor("#cbd5e1").moveTo(tableX, doc.y).lineTo(tableX + tableWidth, doc.y).stroke();
    doc.y += 5;
  };

  drawHeader();
  doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  let runningBalance = 0;

  for (const row of params.rows) {
    const signedAmount = row?.entryType === "payment"
      ? -Math.abs(Number(row?.amountCents || 0))
      : row?.entryType === "adjustment"
      ? Number(row?.amountCents || 0) // Adjustments can be positive or negative
      : Math.abs(Number(row?.amountCents || 0));
    runningBalance += signedAmount;
    const description =
      String(row?.notes || "").trim() ||
      [row?.category, row?.method, row?.reference].map((value) => String(value || "").trim()).filter(Boolean).join(" · ") ||
      "-";
    const values: Record<string, string> = {
      date: String(row?.effectiveDate || "-"),
      type: String(row?.entryType || "-").replace(/_/g, " "),
      description,
      amount: formatLedgerCurrency(signedAmount),
      balance: formatLedgerCurrency(runningBalance),
    };
    const heights = columns.map((column) =>
      doc.heightOfString(values[column.key], {
        width: column.width - rowPaddingX * 2,
        align: column.align,
      })
    );
    const rowHeight = Math.max(20, Math.max(...heights) + rowPaddingY * 2);
    if (doc.y + rowHeight > 740) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    }
    const rowY = doc.y;
    let x = tableX;
    columns.forEach((column) => {
      doc.text(values[column.key], x + rowPaddingX, rowY + rowPaddingY, {
        width: column.width - rowPaddingX * 2,
        align: column.align,
      });
      x += column.width;
    });
    doc.y = rowY + rowHeight;
    doc.strokeColor("#e2e8f0").moveTo(tableX, doc.y).lineTo(tableX + tableWidth, doc.y).stroke();
  }

  if (params.rows.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("No ledger entries for this range.", tableX, doc.y + 5);
  }

  doc.end();
  return done;
}

async function enforceLeaseCapability(req: any, res: Response): Promise<boolean> {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const cap = await requireCapability(landlordId, "leases", req.user);
  if (!cap.ok) {
    res.status(403).json({ error: "Upgrade required", capability: "leases", plan: cap.plan });
    return false;
  }
  return true;
}

router.get("/", (_req: Request, res: Response) => {
  const leases = leaseService.getAll();
  res.json({ leases });
});

router.get("/active", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const leases = await listLandlordLeaseRows(landlordId, { archived: false });
    return res.status(200).json({ ok: true, leases });
  } catch (err) {
    console.error("[GET /api/leases/active] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load active leases" });
  }
});

router.get("/archived", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const leases = await listLandlordLeaseRows(landlordId, { archived: true });
    return res.status(200).json({ ok: true, leases });
  } catch (err) {
    console.error("[GET /api/leases/archived] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load archived leases" });
  }
});

router.get("/reconciliation-candidates", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const [unitsSnap, leasesSnap, propertiesSnap, tenantsSnap] = await Promise.all([
      db.collection("units").where("landlordId", "==", landlordId).get(),
      db.collection("leases").where("landlordId", "==", landlordId).get().catch(() => ({ docs: [] } as any)),
      db.collection("properties").where("landlordId", "==", landlordId).get().catch(() => ({ docs: [] } as any)),
      db.collection("tenants").where("landlordId", "==", landlordId).get().catch(() => ({ docs: [] } as any)),
    ]);

    const currentLeaseKeys = new Set<string>();
    for (const doc of leasesSnap.docs || []) {
      const raw = doc.data() as any;
      if (isHiddenFromLandlordLeaseLists({ id: doc.id, ...raw })) continue;
      if (!isCurrentLeaseStatus(raw?.status)) continue;
      const propertyId = String(raw?.propertyId || "").trim();
      const unitId = String(raw?.unitId || "").trim();
      const unitNumber = String(raw?.unitNumber || raw?.unit || "").trim();
      if (propertyId && unitId) currentLeaseKeys.add(propertyUnitKeyById(propertyId, unitId));
      if (propertyId && unitNumber) currentLeaseKeys.add(propertyUnitKeyByNumber(propertyId, unitNumber));
    }

    const propertyVisibility = new Map<string, ReconciliationPropertyState>(
      (propertiesSnap.docs || []).map((doc: any) => [
        doc.id,
        {
          propertyName:
            String(doc.data()?.name || doc.data()?.addressLine1 || "Property").trim() || "Property",
          isArchived:
            Boolean(doc.data()?.archivedAt) ||
            normalizePortfolioStatus(doc.data()?.portfolioStatus) === "archived",
          hiddenFromActiveLists: doc.data()?.hiddenFromActiveLists === true,
        },
      ])
    );

    const hiddenTenantUnitKeys = new Set<string>();
    for (const doc of tenantsSnap.docs || []) {
      const raw = doc.data() as any;
      const tenantId = String(doc.id || "").trim();
      const propertyId = String(raw?.propertyId || "").trim();
      const unitId = String(raw?.unitId || "").trim();
      const unitNumber = String(raw?.unit || raw?.unitLabel || "").trim();
      const hiddenTenant = raw?.hiddenFromActiveLists === true || isTargetedHiddenTenantId(tenantId);
      if (!hiddenTenant || !propertyId) continue;
      if (unitId) hiddenTenantUnitKeys.add(propertyUnitKeyById(propertyId, unitId));
      if (unitNumber) hiddenTenantUnitKeys.add(propertyUnitKeyByNumber(propertyId, unitNumber));
    }

    const candidates = await Promise.all(
      (unitsSnap.docs || []).map(async (doc: any) => {
        const raw = doc.data() as any;
        const propertyId = String(raw?.propertyId || "").trim();
        const unitId = String(doc.id || raw?.id || raw?.unitId || "").trim();
        const unitNumber = String(raw?.unitNumber || raw?.label || "").trim();
        const propertyState = propertyVisibility.get(propertyId);
        const occupancyStatus = resolveUnitOccupancyStatus(raw);
        if (occupancyStatus !== "occupied") return null;
        if (!propertyId || !unitId) return null;
        if (!propertyState) return null;
        if (propertyState.isArchived || propertyState.hiddenFromActiveLists) return null;
        if (raw?.hiddenFromActiveLists === true) return null;
        if (
          hiddenTenantUnitKeys.has(propertyUnitKeyById(propertyId, unitId)) ||
          (unitNumber && hiddenTenantUnitKeys.has(propertyUnitKeyByNumber(propertyId, unitNumber)))
        ) {
          return null;
        }
        if (
          currentLeaseKeys.has(propertyUnitKeyById(propertyId, unitId)) ||
          (unitNumber && currentLeaseKeys.has(propertyUnitKeyByNumber(propertyId, unitNumber)))
        ) {
          return null;
        }

        const leaseDocument = await loadUnitLeaseDocumentForResponse(raw);
        const occupantName = String(raw?.occupantName || "").trim() || null;
        const rent = Number(raw?.rent || 0);
        const blockingReasons: string[] = [];
        if (!occupantName) blockingReasons.push("occupant_name_required");
        if (!Number.isFinite(rent) || rent <= 0) blockingReasons.push("rent_required");

        return {
          id: unitId,
          unitId,
          propertyId,
          propertyName: propertyState.propertyName,
          unitNumber: unitNumber || "Unit",
          occupantName,
          leaseEndDate: String(raw?.leaseEndDate || "").trim() || null,
          monthlyRent: Number.isFinite(rent) ? rent : 0,
          leaseDocument: (leaseDocument as any)?.leaseDocument || raw?.leaseDocument || null,
          canConvert: blockingReasons.length === 0,
          blockingReasons,
        };
      })
    );

    return res.status(200).json({
      ok: true,
      candidates: candidates.filter(Boolean).sort((a: any, b: any) => {
        const propertyDiff = String(a?.propertyName || "").localeCompare(String(b?.propertyName || ""));
        if (propertyDiff !== 0) return propertyDiff;
        return String(a?.unitNumber || "").localeCompare(String(b?.unitNumber || ""));
      }),
    });
  } catch (err) {
    console.error("[GET /api/leases/reconciliation-candidates] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load lease reconciliation candidates" });
  }
});

router.post("/reconciliation-candidates/:unitId/convert", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const unitId = String(req.params?.unitId || "").trim();
    if (!unitId) return res.status(400).json({ ok: false, error: "unit_id_required" });
    const unitSnap = await db.collection("units").doc(unitId).get();
    if (!unitSnap.exists) return res.status(404).json({ ok: false, error: "unit_not_found" });
    const unit = unitSnap.data() as any;
    if (String(unit?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const propertyId = String(unit?.propertyId || "").trim();
    const unitNumber = String(unit?.unitNumber || unit?.label || "").trim();
    if (!propertyId || !unitNumber) {
      return res.status(400).json({ ok: false, error: "unit_context_incomplete" });
    }
    const occupancyStatus = normalizeStatus(unit?.occupancyStatus || unit?.status);
    if (occupancyStatus !== "occupied") {
      return res.status(400).json({ ok: false, error: "unit_not_occupied" });
    }

    const conflictingLeases = await db.collection("leases").where("landlordId", "==", landlordId).where("propertyId", "==", propertyId).get();
    const hasCurrentLease = (conflictingLeases.docs || []).some((doc: any) => {
      const raw = doc.data() as any;
      if (!isCurrentLeaseStatus(raw?.status)) return false;
      return (
        String(raw?.unitId || "").trim() === unitId ||
        String(raw?.unitNumber || raw?.unit || "").trim() === unitNumber
      );
    });
    if (hasCurrentLease) {
      return res.status(409).json({ ok: false, error: "current_lease_already_exists" });
    }

    const occupantName = String(req.body?.occupantName || unit?.occupantName || "").trim();
    const tenantEmail = String(req.body?.tenantEmail || "").trim().toLowerCase() || null;
    const tenantPhone = normalizePhoneDigits(req.body?.tenantPhone);
    const coApplicantEmail = String(req.body?.coApplicantEmail || "").trim().toLowerCase() || null;
    const coApplicantPhone = normalizePhoneDigits(req.body?.coApplicantPhone);
    const startDate = toIsoDate(req.body?.startDate);
    const endDate = toIsoDate(req.body?.endDate);
    const monthlyRent = Number(req.body?.monthlyRent ?? unit?.rent);
    const coApplicant =
      coApplicantEmail || coApplicantPhone
        ? {
            email: coApplicantEmail,
            phone: coApplicantPhone,
          }
        : null;

    if (!occupantName) return res.status(400).json({ ok: false, error: "occupant_name_required" });
    if (!startDate) return res.status(400).json({ ok: false, error: "start_date_required" });
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      return res.status(400).json({ ok: false, error: "monthly_rent_required" });
    }

    const propertySnap = await db.collection("properties").doc(propertyId).get();
    const property = propertySnap.data() as any;
    const propertyName = String(property?.name || property?.addressLine1 || "Property").trim() || "Property";
    const tenantRef = db.collection("tenants").doc();
    const nowIso = new Date().toISOString();
    await tenantRef.set(
      {
        landlordId,
        fullName: occupantName,
        email: tenantEmail,
        phone: tenantPhone,
        propertyId,
        propertyName,
        unitId,
        unit: unitNumber,
        currentLeaseId: null,
        leaseStart: startDate,
        leaseEnd: endDate || null,
        monthlyRent,
        coApplicant,
        status: "Current",
        createdAt: nowIso,
        updatedAt: nowIso,
        source: "occupied_unit_reconciliation",
      },
      { merge: false }
    );

    const riskSnapshot = await computeLeaseRiskSnapshot({
      landlordId,
      propertyId,
      unitId,
      tenantIds: [tenantRef.id],
      monthlyRent,
    });
    const riskFields = buildLeaseRiskPersistenceFields({}, riskSnapshot, {
      trigger: "lease_create",
      source: "occupied_unit_reconciliation",
    });

    const lease = leaseService.create({
      tenantId: tenantRef.id,
      tenantIds: [tenantRef.id],
      primaryTenantId: tenantRef.id,
      propertyId,
      unitNumber,
      monthlyRent,
      startDate,
      endDate,
      risk: riskFields.risk,
      riskTimeline: riskFields.riskTimeline,
    });

    const firestoreLeaseRecord = {
      landlordId,
      tenantId: tenantRef.id,
      tenantIds: [tenantRef.id],
      primaryTenantId: tenantRef.id,
      propertyId,
      unitId,
      unitNumber,
      monthlyRent,
      startDate,
      endDate: endDate || null,
      automationEnabled: lease.automationEnabled ?? true,
      renewalStatus: lease.renewalStatus ?? "unknown",
      status: lease.status,
      risk: lease.risk ?? null,
      riskScore: lease.riskScore ?? lease.risk?.score ?? null,
      riskGrade: lease.riskGrade ?? lease.risk?.grade ?? null,
      riskConfidence: lease.riskConfidence ?? lease.risk?.confidence ?? null,
      riskTimeline: Array.isArray((lease as any).riskTimeline) ? (lease as any).riskTimeline : [],
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
      source: "occupied_unit_reconciliation",
      sourceUnitId: unitId,
      referenceDocument: unit?.leaseDocument || null,
      coApplicant,
    };
    await db.collection("leases").doc(lease.id).set(firestoreLeaseRecord, { merge: false });
    await tenantRef.set({ currentLeaseId: lease.id, updatedAt: new Date().toISOString() }, { merge: true });

    const enrichedLease = await enrichLeaseRow({ id: lease.id, ...firestoreLeaseRecord });
    const leaseNotification = await sendLeaseAvailableEmail({
      leaseId: lease.id,
      tenantId: tenantRef.id,
      landlordId,
      tenantEmail,
      tenantName: occupantName,
      propertyLabel: propertyName,
      unitLabel: unitNumber || null,
      startDate,
    });
    return res.status(201).json({
      ok: true,
      lease: enrichedLease,
      tenant: { id: tenantRef.id, fullName: occupantName, email: tenantEmail, phone: tenantPhone },
      leaseNotification,
    });
  } catch (err) {
    console.error("[POST /api/leases/reconciliation-candidates/:unitId/convert] error", err);
    return res.status(500).json({ ok: false, error: "Failed to convert occupied unit to lease" });
  }
});

router.post("/drafts", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const draft = validateCreateInput(landlordId, req.body || {});
    const ref = db.collection("leaseDrafts").doc();
    await ref.set(draft, { merge: false });
    return res.status(201).json({ ok: true, draftId: ref.id, draft: { id: ref.id, ...draft } });
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status < 500) {
      return res.status(status).json({ ok: false, error: String(err?.code || "invalid_input") });
    }
    console.error("[POST /api/leases/drafts] error", err);
    return res.status(500).json({ ok: false, error: "Failed to create lease draft" });
  }
});

router.get("/drafts/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const snap = await getDraftById(id);
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const draft = snap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return res.json({ ok: true, draft: { id: snap.id, ...draft } });
  } catch (err) {
    console.error("[GET /api/leases/drafts/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load draft" });
  }
});

router.patch("/drafts/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const ref = db.collection("leaseDrafts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const existing = snap.data() as any;
    if (String(existing?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    const next = applyPatch(existing, req.body || {});
    await ref.set(next, { merge: false });
    return res.json({ ok: true, draft: { id, ...next } });
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status < 500) {
      return res.status(status).json({ ok: false, error: String(err?.code || "invalid_input") });
    }
    console.error("[PATCH /api/leases/drafts/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to update draft" });
  }
});

router.post("/drafts/:id/generate", requireLandlord, async (req: any, res: Response) => {
  const correlationId = Math.random().toString(36).slice(2, 10);
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "draft_id_required" });
    const ref = db.collection("leaseDrafts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const draft = snap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    if (String(draft?.province || "").toUpperCase() !== NS_PROVINCE) {
      return res.status(400).json({ ok: false, error: "province_not_supported" });
    }
    if (String(draft?.templateVersion || "") !== NS_TEMPLATE_VERSION) {
      return res.status(400).json({ ok: false, error: "template_version_invalid" });
    }

    const generated = await generateScheduleA({
      landlordId,
      draftId: id,
      draft,
      landlordDisplayName: String(
        req.user?.displayName || req.user?.name || req.user?.email || "Landlord"
      ),
      tenantDisplayNames: Array.isArray(req.body?.tenantNames)
        ? req.body.tenantNames.map((v: any) => String(v || "").trim()).filter(Boolean)
        : [],
      propertyAddressLine: String(req.body?.propertyAddress || "").trim() || String(draft.propertyId || ""),
      unitLabel: String(req.body?.unitLabel || "").trim() || String(draft.unitId || ""),
    });
    const file =
      generated.file ||
      ({
        kind: "schedule-a-pdf",
        url: "inline://schedule-a.pdf",
        sha256: generated.sha256,
        sizeBytes: generated.sizeBytes,
      } as const);

    const now = Date.now();
    const snapshotRef = db.collection("leaseSnapshots").doc();
    const generatedFiles = [file];
    const snapshotDoc = {
      ...draft,
      draftId: id,
      sourceDraftId: id,
      status: "generated",
      generatedAt: now,
      generatedFiles,
    };
    await snapshotRef.set(snapshotDoc, { merge: false });

    const generatedLeaseFile = firstGeneratedLeasePdfFile(generatedFiles);
    if (generatedLeaseFile) {
      await linkGeneratedLeasePdfToTenantWorkspace({
        draft,
        draftId: id,
        landlordId,
        snapshotId: snapshotRef.id,
        file: generatedLeaseFile,
        actorId: String(req.user?.id || req.user?.email || landlordId).trim() || null,
      });
    }

    await ref.set(
      {
        ...draft,
        status: "generated",
        updatedAt: now,
        lastGeneratedSnapshotId: snapshotRef.id,
        lastGeneratedDocumentUrl: generatedLeaseFile ? String(generatedLeaseFile.url || "").trim() : null,
      },
      { merge: false }
    );

    const wantsInline =
      String(req.query?.inline || "").toLowerCase() === "1" ||
      String(req.headers?.accept || "").toLowerCase().includes("application/pdf") ||
      !generated.file;

    if (wantsInline) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="schedule-a.pdf"');
      return res.status(200).send(generated.pdfBuffer);
    }

    return res.status(201).json({
      ok: true,
      snapshotId: snapshotRef.id,
      scheduleAUrl: generated.file?.url || file.url,
      generatedFiles,
    });
  } catch (err: any) {
    console.error("[POST /api/leases/drafts/:id/generate] error", {
      correlationId,
      draftId: String(req.params?.id || ""),
      landlordId: String(req.user?.landlordId || req.user?.id || ""),
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
    return res
      .status(500)
      .json({ ok: false, error: "Failed to generate Schedule A PDF", correlationId });
  }
});

router.post("/drafts/:draftId/activate", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const draftId = String(req.params?.draftId || "").trim();
    if (!draftId) return res.status(400).json({ ok: false, error: "draft_id_required" });

    const draftRef = db.collection("leaseDrafts").doc(draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      return res.status(404).json({ ok: false, error: "draft_not_found" });
    }
    const draft = draftSnap.data() as any;
    if (String(draft?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const propertyId = String(draft?.propertyId || "").trim();
    const unitId = String(draft?.unitId || "").trim();
    const tenantIds = Array.isArray(draft?.tenantIds)
      ? draft.tenantIds.map((v: any) => String(v || "").trim()).filter(Boolean)
      : [];
    const termType = String(draft?.termType || "").trim();
    const startDate = String(draft?.startDate || "").trim();
    const endDate = draft?.endDate == null ? null : String(draft.endDate || "").trim();
    const baseRentCents = Number(draft?.baseRentCents || 0);
    const dueDay = Number(draft?.dueDay || 0);
    const paymentMethod = String(draft?.paymentMethod || "").trim();
    const province = String(draft?.province || "").toUpperCase();

    if (!propertyId) return res.status(400).json({ ok: false, error: "property_required" });
    if (!unitId) return res.status(400).json({ ok: false, error: "unit_required" });
    if (!tenantIds.length) return res.status(400).json({ ok: false, error: "tenant_required" });
    if (!startDate) return res.status(400).json({ ok: false, error: "start_date_required" });
    if (!termType) return res.status(400).json({ ok: false, error: "term_type_required" });
    if (termType === "fixed" && !endDate) {
      return res.status(400).json({ ok: false, error: "end_date_required" });
    }
    if (!Number.isFinite(baseRentCents) || baseRentCents <= 0) {
      return res.status(400).json({ ok: false, error: "base_rent_required" });
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      return res.status(400).json({ ok: false, error: "due_day_required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ ok: false, error: "payment_method_required" });
    }

    const generatedLeaseDocument = await loadGeneratedLeaseDocumentForDraft(draftId, draft);

    if (String(draft?.leaseId || "").trim()) {
      const existingLeaseId = String(draft.leaseId).trim();
      const existingLeaseSnap = await db.collection("leases").doc(existingLeaseId).get();
      if (existingLeaseSnap.exists) {
        if (generatedLeaseDocument) {
          await linkGeneratedLeasePdfToTenantWorkspace({
            draft: { ...draft, leaseId: existingLeaseId },
            draftId,
            landlordId,
            snapshotId: generatedLeaseDocument.snapshotId || `activated_${existingLeaseId}`,
            file: generatedLeaseDocument.file,
            actorId: String(req.user?.id || req.user?.email || landlordId).trim() || null,
          });
          const repairedLeaseSnap = await db.collection("leases").doc(existingLeaseId).get();
          return res.status(200).json({
            ok: true,
            leaseId: existingLeaseId,
            lease: { id: existingLeaseId, ...(repairedLeaseSnap.data() as any) },
          });
        }
        return res.status(200).json({
          ok: true,
          leaseId: existingLeaseId,
          lease: { id: existingLeaseId, ...(existingLeaseSnap.data() as any) },
        });
      }
    }

    const conflicts = await assertNoConflictingActiveAgreement({
      landlordId,
      propertyId,
      unitId,
      tenantIds,
      startDate,
      endDate,
      monthlyRent: Math.round(baseRentCents / 100),
    });
    if (conflicts.length) {
      return res.status(409).json({ ok: false, error: "conflicting_active_lease_agreement", conflictLeaseIds: conflicts.map((entry: any) => entry.lease.id) });
    }

    const now = Date.now();
    const tenantId = tenantIds[0];
    const leaseRef = db.collection("leases").doc();
    const riskSnapshot = await computeLeaseRiskSnapshot({
      landlordId,
      propertyId,
      unitId,
      tenantIds,
      monthlyRent: Math.round(baseRentCents / 100),
    });
    const riskFields = buildLeaseRiskPersistenceFields({}, riskSnapshot, {
      trigger: "draft_activate",
      source: "lease_draft_activation",
    });
    const leaseRecord: any = {
      landlordId,
      tenantId,
      tenantIds,
      primaryTenantId: tenantId,
      propertyId,
      unitId,
      unitNumber: unitId,
      province: province || "NS",
      termType,
      startDate,
      endDate: endDate || null,
      baseRentCents,
      monthlyRent: Math.round(baseRentCents / 100),
      parkingCents: Number(draft?.parkingCents || 0),
      dueDay,
      paymentMethod,
      nsfFeeCents: draft?.nsfFeeCents ?? null,
      utilitiesIncluded: Array.isArray(draft?.utilitiesIncluded) ? draft.utilitiesIncluded : [],
      depositCents: draft?.depositCents ?? null,
      additionalClauses: String(draft?.additionalClauses || ""),
      risk: riskFields.risk,
      riskScore: riskFields.riskScore,
      riskGrade: riskFields.riskGrade,
      riskConfidence: riskFields.riskConfidence,
      riskTimeline: riskFields.riskTimeline,
      automationEnabled: true,
      renewalStatus: "unknown",
      status: "active",
      sourceDraftId: draftId,
      createdAt: now,
      updatedAt: now,
    };
    if (generatedLeaseDocument) {
      leaseRecord.documentUrl = generatedLeaseDocument.url;
      leaseRecord.approvedDocumentUrl = generatedLeaseDocument.url;
      leaseRecord.documentRef = generatedLeaseDocument.url;
      leaseRecord.documentGeneratedAt = now;
      leaseRecord.leaseDocumentGeneratedAt = now;
      leaseRecord.latestLeaseSnapshotId = generatedLeaseDocument.snapshotId;
    }
    await leaseRef.set(leaseRecord, { merge: false });
    if (generatedLeaseDocument) {
      await linkGeneratedLeasePdfToTenantWorkspace({
        draft: { ...draft, leaseId: leaseRef.id },
        draftId,
        landlordId,
        snapshotId: generatedLeaseDocument.snapshotId || `activated_${leaseRef.id}`,
        file: generatedLeaseDocument.file,
        actorId: String(req.user?.id || req.user?.email || landlordId).trim() || null,
      });
    }
    await syncOccupancyAfterActiveLeaseWrite(
      {
        tenantId,
        leaseId: leaseRef.id,
        landlordId,
        propertyId,
        unitId,
      },
      "[POST /api/leases/drafts/:draftId/activate]"
    );

    // Keep in-memory lease service in sync for existing automation/toggle flows.
    leaseService.getAll().push({
      id: leaseRef.id,
      tenantId,
      tenantIds,
      primaryTenantId: tenantId,
      propertyId,
      unitNumber: unitId,
      monthlyRent: Math.round(baseRentCents / 100),
      startDate,
      endDate: endDate || null,
      automationEnabled: true,
      renewalStatus: "unknown",
      status: "active",
      risk: riskFields.risk,
      riskScore: riskFields.riskScore,
      riskGrade: riskFields.riskGrade,
      riskConfidence: riskFields.riskConfidence,
      riskTimeline: riskFields.riskTimeline,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    await draftRef.set(
      {
        ...draft,
        status: "activated",
        leaseId: leaseRef.id,
        activatedAt: now,
        updatedAt: now,
      },
      { merge: false }
    );
    await writeCanonicalEvent({
      domain: "lease",
      action: "created",
      status: "active",
      actor: {
        type: "landlord",
        role: "landlord",
        id: landlordId,
      },
      resource: {
        type: "lease",
        id: leaseRef.id,
        parentType: "lease_draft",
        parentId: draftId,
      },
      occurredAt: now,
      visibility: "landlord",
      summary: "Lease record created from draft",
      metadata: {
        propertyId,
        unitId,
        tenantIds,
      },
    });
    await writeCanonicalEvent({
      domain: "lease",
      action: "activated",
      status: "active",
      actor: {
        type: "landlord",
        role: "landlord",
        id: landlordId,
      },
      resource: {
        type: "lease",
        id: leaseRef.id,
        parentType: "lease_draft",
        parentId: draftId,
      },
      occurredAt: now,
      visibility: "landlord",
      summary: "Lease activated",
      metadata: {
        propertyId,
        unitId,
        tenantIds,
      },
    });

    const leaseNotification = await sendLeaseAvailableEmail({
      leaseId: leaseRef.id,
      tenantId,
      landlordId,
      propertyLabel: null,
      unitLabel: String(draft?.unitLabel || draft?.unitNumber || "").trim() || null,
      startDate,
    });

    return res.status(200).json({
      ok: true,
      leaseId: leaseRef.id,
      lease: { id: leaseRef.id, ...leaseRecord },
      leaseNotification,
    });
  } catch (err: any) {
    console.error("[POST /api/leases/drafts/:draftId/activate] error", err);
    return res.status(500).json({ ok: false, error: "Failed to activate lease draft" });
  }
});

router.get("/snapshots/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "snapshot_id_required" });
    const snap = await getSnapshotById(id);
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const snapshot = snap.data() as any;
    if (String(snapshot?.landlordId || "").trim() !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return res.json({ ok: true, snapshot: { id: snap.id, ...snapshot } });
  } catch (err) {
    console.error("[GET /api/leases/snapshots/:id] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load snapshot" });
  }
});

router.post("/:id/automation/tasks/regenerate", requireLandlord, async (req: any, res: Response) => {
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const leaseResult = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
  if (!leaseResult.ok) {
    return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
  }
  const lease = leaseResult.lease as any;
  const tasks = regenerateLeaseAutomationTasks({
    id: lease.id,
    startDate: lease.startDate,
    endDate: lease.endDate || null,
    automationEnabled: (lease as any).automationEnabled,
    renewalStatus: (lease as any).renewalStatus,
  });
  return res.status(200).json({ ok: true, tasks });
});

router.get("/:id/automation/tasks", requireLandlord, async (req: any, res: Response) => {
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const leaseResult = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
  if (!leaseResult.ok) {
    return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
  }
  const lease = leaseResult.lease as any;
  const tasks = getLeaseAutomationTasks(lease.id);
  return res.status(200).json({ ok: true, tasks });
});

router.get("/:leaseId/notes", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });
    const notes = await listLeaseNotes(leaseId, landlordId);
    return res.status(200).json({ ok: true, notes });
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/notes] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load lease notes" });
  }
});

router.post("/:leaseId/notes", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const actorUserId = String(req.user?.id || req.user?.email || landlordId).trim();
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "note_required" });
    const noteRef = db.collection(LEASE_NOTES_COLLECTION).doc();
    const record = {
      id: noteRef.id,
      leaseId,
      landlordId,
      note: note.slice(0, 5000),
      createdAt: Date.now(),
      createdBy: actorUserId || null,
    };
    await noteRef.set(record, { merge: false });
    return res.status(201).json({ ok: true, note: record });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/notes] error", err);
    return res.status(500).json({ ok: false, error: "Failed to save lease note" });
  }
});

router.post("/:leaseId/archive", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const actorUserId = String(req.user?.id || req.user?.email || landlordId).trim() || null;
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });
    if (leaseCheck.source === "firestore") {
      await db.collection("leases").doc(leaseId).set(
        {
          archivedAt: new Date().toISOString(),
          archivedByUserId: actorUserId,
          restoredAt: null,
          restoredByUserId: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      const refreshed = await getLeaseEntityForLandlord(leaseId, landlordId);
      if (!refreshed.ok) return res.status(refreshed.status).json({ ok: false, error: refreshed.error });
      return res.status(200).json({ ok: true, lease: await enrichLeaseRow({ id: leaseId, ...(refreshed.lease as any) }) });
    }
    return res.status(400).json({ ok: false, error: "archive_requires_firestore_lease" });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/archive] error", err);
    return res.status(500).json({ ok: false, error: "Failed to archive lease" });
  }
});

router.post("/:leaseId/payment-rails/enable", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!leaseId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const result = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    const raw = result.lease as any;
    const lease = normalizeLeaseRow(leaseId, raw);
    const leasePaymentProjection = await buildLeasePaymentProjection({
      rawLease: raw,
      lease: {
        id: leaseId,
        landlordId: String(lease.landlordId || "").trim() || null,
        tenantId: String(lease.primaryTenantId || lease.tenantId || lease.tenantIds?.[0] || "").trim() || null,
        primaryTenantId: String(lease.primaryTenantId || "").trim() || null,
        tenantIds: Array.isArray(lease.tenantIds) ? lease.tenantIds : [],
        propertyId: lease.propertyId,
        unitId: String(lease.unitId || "").trim() || null,
        unitNumber: String(lease.unitNumber || "").trim() || null,
        monthlyRent: lease.monthlyRent,
        startDate: lease.startDate,
        endDate: lease.endDate,
        status: lease.status,
      },
      leaseId,
      documentUrl: null,
    });
    if (leasePaymentProjection.blockedReason) {
      return res.status(400).json({
        ok: false,
        error: "LEASE_PAYMENT_RAIL_INELIGIBLE",
        detail: leasePaymentProjection.blockedReason,
      });
    }

    const tenantId = String(lease.primaryTenantId || lease.tenantId || lease.tenantIds?.[0] || "").trim();
    const enabled = await enableRentCollectionForLease({
      leaseId,
      tenantId,
      landlordId,
      actorId: String(req.user?.id || landlordId),
    });
    return res.status(200).json({
      ok: true,
      data: {
        leaseId,
        paymentRail: {
          enabled: enabled.enabled,
          enabledAt: enabled.enabledAt,
          processor: enabled.processor,
          eligibility: "eligible",
          blockedReason: null,
        },
      },
    });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/payment-rails/enable] error", err);
    return res.status(500).json({ ok: false, error: "LEASE_PAYMENT_RAIL_ENABLE_FAILED" });
  }
});

router.get("/:leaseId/payments", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!leaseId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const result = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    const raw = result.lease as any;
    const lease = normalizeLeaseRow(leaseId, raw);
    const data = (
      await buildLeasePaymentProjection({
        rawLease: raw,
        lease: {
          id: leaseId,
          landlordId: String(lease.landlordId || "").trim() || null,
          tenantId: String(lease.primaryTenantId || lease.tenantId || lease.tenantIds?.[0] || "").trim() || null,
          primaryTenantId: String(lease.primaryTenantId || "").trim() || null,
          tenantIds: Array.isArray(lease.tenantIds) ? lease.tenantIds : [],
          propertyId: lease.propertyId,
          unitId: String(lease.unitId || "").trim() || null,
          unitNumber: String(lease.unitNumber || "").trim() || null,
          monthlyRent: lease.monthlyRent,
          startDate: lease.startDate,
          endDate: lease.endDate,
          status: lease.status,
        },
        leaseId,
        documentUrl: null,
      })
    ).rentPaymentSummary;
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/payments] error", err);
    return res.status(500).json({ ok: false, error: "LEASE_PAYMENT_STATUS_FAILED" });
  }
});

router.post("/:leaseId/restore", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const actorUserId = String(req.user?.id || req.user?.email || landlordId).trim() || null;
    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });
    if (leaseCheck.source === "firestore") {
      await db.collection("leases").doc(leaseId).set(
        {
          archivedAt: null,
          archivedByUserId: null,
          restoredAt: new Date().toISOString(),
          restoredByUserId: actorUserId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      const refreshed = await getLeaseEntityForLandlord(leaseId, landlordId);
      if (!refreshed.ok) return res.status(refreshed.status).json({ ok: false, error: refreshed.error });
      return res.status(200).json({ ok: true, lease: await enrichLeaseRow({ id: leaseId, ...(refreshed.lease as any) }) });
    }
    return res.status(400).json({ ok: false, error: "restore_requires_firestore_lease" });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/restore] error", err);
    return res.status(500).json({ ok: false, error: "Failed to restore lease" });
  }
});

router.get("/:id", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const result = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    if (result.source === "firestore") {
      return res.json({ lease: await enrichLeaseRow({ id: String(req.params?.id || "").trim(), ...(result.lease as any) }) });
    }
    return res.json({ lease: result.lease });
  } catch (err) {
    console.error("[GET /api/leases/:id] error", err);
    return res.status(500).json({ error: "Failed to load lease" });
  }
});

router.get("/tenant/:tenantId", requireLandlord, async (req: any, res: Response) => {
  const { tenantId } = req.params;
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenantId is required" });
  }
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const memoryLeases = leaseService.getByTenantId(tenantId).map((lease) => normalizeLeaseRow(String(lease.id), lease));
  try {
    const collectionRef: any = (db as any).collection("leases");
    if (!collectionRef || typeof collectionRef.where !== "function") {
      return res.status(200).json({ ok: true, leases: memoryLeases });
    }
    const [directSnap, arraySnap] = await Promise.all([
      collectionRef.where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] })),
      collectionRef.where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] })),
    ]);
    const firestoreLeases = [...(directSnap.docs || []), ...(arraySnap.docs || [])]
      .map((doc: any) => {
        const raw = doc.data() as any;
        const lease = normalizeLeaseRow(doc.id, raw);
        return {
          ...lease,
          _rawPropertyAddress:
            [raw?.propertyAddress, raw?.propertyAddressLine1, raw?.propertyAddressLabel]
              .map((value: any) => String(value || "").trim())
              .find(Boolean) || null,
          _rawPropertyName:
            [raw?.propertyName, raw?.propertyLabel]
              .map((value: any) => String(value || "").trim())
              .find(Boolean) || null,
        };
      })
      .filter((lease: any) => !landlordId || String(lease.landlordId || "").trim() === landlordId)
      .map(({ landlordId: _landlordId, ...lease }: any) => lease);
    const propertyIds = Array.from(
      new Set(
        firestoreLeases.map((lease: any) => String(lease.propertyId || "").trim()).filter(Boolean)
      )
    );
    const propertyEntries = await Promise.all(
      propertyIds.map(async (propertyId) => {
        const snap = await db.collection("properties").doc(propertyId).get().catch(() => null);
        if (!snap?.exists) return [propertyId, null] as const;
        const data = snap.data() as any;
        return [
          propertyId,
          {
            propertyName: String(data?.name || data?.addressLine1 || "").trim() || null,
            propertyAddress: String(data?.addressLine1 || data?.address || "").trim() || null,
          },
        ] as const;
      })
    );
    const propertyMap = new Map<string, { propertyName: string | null; propertyAddress: string | null } | null>(
      propertyEntries
    );
    const displayLeases = await Promise.all(
      firestoreLeases.map(async (lease: any) => {
        const propertyData = propertyMap.get(String(lease.propertyId || "").trim()) || null;
        const propertyName = lease._rawPropertyName || propertyData?.propertyName || null;
        const propertyAddress = lease._rawPropertyAddress || propertyData?.propertyAddress || null;
        const { _rawPropertyName, _rawPropertyAddress, ...rest } = lease;
        const hydrated = await hydrateLeaseUnitDisplayFields(rest, landlordId || null);
        return {
          ...hydrated,
          propertyName,
          propertyAddress,
          propertyLabel: propertyName,
        };
      })
    );
    return res.status(200).json({ ok: true, leases: mergeLeaseRows([...memoryLeases, ...displayLeases]) });
  } catch {
    return res.status(200).json({ ok: true, leases: memoryLeases });
  }
});

router.options("/tenant/:tenantId", (_req: Request, res: Response) => {
  return res.sendStatus(204);
});

router.get("/property/:propertyId", requireLandlord, async (req: any, res: Response) => {
  const { propertyId } = req.params;
  if (!propertyId) {
    return res.status(400).json({ error: "propertyId is required" });
  }
  const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
  const memoryLeases = leaseService.getByPropertyId(propertyId).map((lease) => normalizeLeaseRow(String(lease.id), lease));
  try {
    const collectionRef: any = (db as any).collection("leases");
    if (!collectionRef || typeof collectionRef.where !== "function") {
      return res.status(200).json({ leases: memoryLeases });
    }
    const snap = await collectionRef.where("propertyId", "==", propertyId).get();
    const firestoreLeaseRows = (snap.docs || [])
      .map((doc: any) => {
        const raw = doc.data() as any;
        const lease = normalizeLeaseRow(doc.id, raw);
        return { raw, lease: { ...lease, landlordId: String(raw?.landlordId || "").trim() } };
      })
      .filter((entry: any) => !landlordId || entry.lease.landlordId === landlordId);

    const combinedRows = [
      ...memoryLeases,
      ...firestoreLeaseRows.map((entry: any) => {
        const { landlordId: _landlordId, ...lease } = entry.lease;
        return lease;
      }),
    ];

    const units = await loadUnitsForProperty(db as any, propertyId, landlordId);
    const agreementCandidates = [
      ...memoryLeases.map((lease) => ({ lease: toCanonicalLeaseRecord(lease.id, lease as any, units), raw: lease as any })),
      ...firestoreLeaseRows.map((entry: any) => ({ lease: toCanonicalLeaseRecord(entry.lease.id, entry.raw, units), raw: entry.raw })),
    ].filter((entry) => entry.lease.status);
    const { included: scopedAgreementCandidates } = filterPropertyScopedLeases({
      leases: agreementCandidates.map((candidate) => candidate.lease),
      requestedPropertyId: propertyId,
      requestedLandlordId: landlordId,
      units,
      logger: (message, detail) => {
        console.warn(message, detail);
      },
    });
    const allowedLeaseIds = new Set(scopedAgreementCandidates.map((lease) => lease.id));
    const filteredAgreementCandidates = agreementCandidates.filter((candidate) => allowedLeaseIds.has(candidate.lease.id));
    const grouped = groupLeaseAgreementCandidates(filteredAgreementCandidates);
    const groupedWinners = [
      ...grouped.mergeGroups.map((group) => pickAgreementWinner(group.candidates).lease),
      ...grouped.ambiguousGroups.map((group) => pickAgreementWinner(group.candidates).lease),
      ...grouped.singles.map((candidate) => candidate.lease),
    ];
    const winnerIds = new Set(
      dedupePropertyScopedLeasesByUnit(groupedWinners).map((lease) => lease.id)
    );

    // Occupancy and rent roll consumers must operate on lease agreements, not per-tenant rows.
    const summaryLeases = mergeLeaseRows(combinedRows.filter((lease) => winnerIds.has(lease.id)));
    const displayLeases = summaryLeases.map((lease) => hydrateLeaseUnitDisplayFieldsFromUnits(lease, units));
    const response: any = { leases: displayLeases };
    response.credibilitySummary = await loadPropertyCredibilitySummary({
      firestore: db as any,
      propertyId,
      landlordId,
      leases: summaryLeases,
    });
    if (String(req.query?.debug || "") === "1") {
      const integrity = await loadPropertyLeaseIntegrityDiagnostics(propertyId, landlordId, db as any);
      response.diagnostics = integrity.diagnostics;
    }
    return res.status(200).json(response);
  } catch (err) {
    console.warn("[GET /api/leases/property/:propertyId] firestore fallback", err);
    return res.status(200).json({ leases: memoryLeases });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const body = req.body as Partial<CreateLeasePayload>;
    if (!body.tenantId || !body.propertyId || !body.unitNumber) {
      return res.status(400).json({
        error: "tenantId, propertyId, and unitNumber are required",
      });
    }
    if (
      typeof body.monthlyRent !== "number" ||
      Number.isNaN(Number(body.monthlyRent))
    ) {
      return res.status(400).json({ error: "monthlyRent must be a number" });
    }
    if (!body.startDate) {
      return res.status(400).json({ error: "startDate is required" });
    }

    const landlordId = String((req as any)?.user?.landlordId || (req as any)?.user?.id || "").trim();
    const tenantIds = Array.isArray((body as any)?.tenantIds)
      ? (body as any).tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : [String(body.tenantId || "").trim()].filter(Boolean);
    const unitSelection = await resolveLeaseUnitSelection({
      landlordId,
      propertyId: String(body.propertyId || "").trim(),
      unitReference: String(body.unitNumber || "").trim(),
    });

    const conflicts = await assertNoConflictingActiveAgreement({
      landlordId,
      propertyId: body.propertyId,
      unitId: unitSelection.unitId,
      tenantIds,
      startDate: body.startDate,
      endDate: body.endDate,
      monthlyRent: Number(body.monthlyRent),
    });
    if (conflicts.length) {
      return res.status(409).json({
        error: "conflicting_active_lease_agreement",
        message: "A conflicting active lease agreement already exists for this unit and term",
        conflictLeaseIds: conflicts.map((entry: any) => entry.lease.id),
      });
    }

    const riskSnapshot = await computeLeaseRiskSnapshot({
      landlordId,
      propertyId: body.propertyId,
      unitId: unitSelection.unitId,
      tenantIds,
      monthlyRent: Number(body.monthlyRent),
    });
    const riskFields = buildLeaseRiskPersistenceFields({}, riskSnapshot, {
      trigger: "lease_create",
      source: "lease_create_route",
    });

    const payload: CreateLeasePayload = {
      tenantId: body.tenantId,
      tenantIds,
      primaryTenantId: tenantIds[0] || body.tenantId,
      propertyId: body.propertyId,
      unitNumber: unitSelection.unitLabel,
      monthlyRent: Number(body.monthlyRent),
      startDate: body.startDate,
      endDate: body.endDate,
      risk: riskFields.risk,
      riskTimeline: riskFields.riskTimeline,
    };

    const lease = leaseService.create(payload);
    let firestoreLeaseWritten = false;
    if (landlordId) {
      const firestoreLeaseRecord = {
        landlordId,
        tenantId: lease.tenantId,
        tenantIds,
        primaryTenantId: tenantIds[0] || body.tenantId,
        propertyId: lease.propertyId,
        unitId: unitSelection.unitId,
        unitNumber: unitSelection.unitLabel,
        unitLabel: unitSelection.unitLabel,
        monthlyRent: lease.monthlyRent,
        startDate: lease.startDate,
        endDate: lease.endDate ?? null,
        automationEnabled: lease.automationEnabled ?? true,
        renewalStatus: lease.renewalStatus ?? "unknown",
        status: lease.status,
        risk: lease.risk ?? null,
        riskScore: lease.riskScore ?? lease.risk?.score ?? null,
        riskGrade: lease.riskGrade ?? lease.risk?.grade ?? null,
        riskConfidence: lease.riskConfidence ?? lease.risk?.confidence ?? null,
        riskTimeline: Array.isArray((lease as any).riskTimeline) ? (lease as any).riskTimeline : [],
        createdAt: lease.createdAt,
        updatedAt: lease.updatedAt,
      };
      try {
        await db.collection("leases").doc(lease.id).set(firestoreLeaseRecord, { merge: false });
        firestoreLeaseWritten = true;
      } catch (error: any) {
        console.warn("[POST /api/leases] firestore lease write failed", error);
      }
      if (firestoreLeaseWritten) {
        await syncOccupancyAfterActiveLeaseWrite(
          {
            tenantId: String(lease.tenantId || body.tenantId || "").trim(),
            leaseId: lease.id,
            landlordId,
            propertyId: String(lease.propertyId || body.propertyId || "").trim(),
            unitId: unitSelection.unitId,
          },
          "[POST /api/leases]"
        );
      }
    }
    const leaseNotification =
      landlordId && firestoreLeaseWritten
        ? await sendLeaseAvailableEmail({
            leaseId: lease.id,
            tenantId: String(lease.tenantId || body.tenantId || "").trim(),
            landlordId,
            propertyLabel: null,
            unitLabel: unitSelection.unitLabel,
            startDate: lease.startDate,
          })
        : { attempted: false, sent: false, reason: "lease_not_persisted" };
    res.status(201).json({
      lease: {
        ...lease,
        unitId: unitSelection.unitId,
        unitNumber: unitSelection.unitLabel,
        unitLabel: unitSelection.unitLabel,
      },
      leaseNotification,
    });
  } catch (err) {
    console.error("[POST /api/leases] error", err);
    res.status(500).json({ error: "Failed to process lease" });
  }
});

router.put("/:id", async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const payload = req.body as UpdateLeasePayload;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseResult = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ error: leaseResult.error });
    }

    if (leaseResult.source === "firestore") {
      const next = {
        ...(payload.monthlyRent !== undefined ? { monthlyRent: payload.monthlyRent } : {}),
        ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate ?? null } : {}),
        ...(payload.automationEnabled !== undefined ? { automationEnabled: payload.automationEnabled } : {}),
        ...(payload.renewalStatus !== undefined ? { renewalStatus: payload.renewalStatus } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        updatedAt: new Date().toISOString(),
      };
      await db.collection("leases").doc(String(req.params?.id || "").trim()).set(next, { merge: true });
      const refreshed = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
      if (!refreshed.ok) return res.status(refreshed.status).json({ error: refreshed.error });
      return res.json({ lease: await enrichLeaseRow({ id: String(req.params?.id || "").trim(), ...(refreshed.lease as any) }) });
    }

    const lease = leaseService.update(req.params.id, payload);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[PUT /api/leases/:id] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

router.post("/:id/end", async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const endDate: string = req.body?.endDate || new Date().toISOString();
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseResult = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ error: leaseResult.error });
    }
    if (leaseResult.source === "firestore") {
      await db.collection("leases").doc(String(req.params?.id || "").trim()).set(
        {
          status: "ended",
          endDate,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      try {
        await reconcilePropertyUnitVacancyForLeaseEnd({ id: String(req.params?.id || "").trim(), ...(leaseResult.lease as any) });
      } catch (reconcileErr: any) {
        console.error("[POST /api/leases/:id/end] occupancy reconciliation failed", {
          leaseId: String(req.params?.id || "").trim(),
          landlordId,
          error: reconcileErr?.message || String(reconcileErr),
          code: reconcileErr?.code || null,
        });
        return res.status(409).json({
          ok: false,
          error: "lease_end_occupancy_reconciliation_failed",
        });
      }
      const refreshed = await getLeaseEntityForLandlord(String(req.params?.id || "").trim(), landlordId);
      if (!refreshed.ok) return res.status(refreshed.status).json({ error: refreshed.error });
      return res.json({ lease: await enrichLeaseRow({ id: String(req.params?.id || "").trim(), ...(refreshed.lease as any) }) });
    }
    const lease = leaseService.endLease(req.params.id, endDate);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[POST /api/leases/:id/end] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

router.post("/:id/restore-active", requireLandlord, async (req: any, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    const leaseId = String(req.params?.id || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });

    const leaseResult = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseResult.ok) {
      return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
    }
    if (leaseResult.source !== "firestore") {
      return res.status(400).json({ ok: false, error: "lease_restore_requires_firestore_lease" });
    }

    const existingLease = { id: leaseId, ...(leaseResult.lease as any) };
    if (normalizeStatus(existingLease?.status) !== "ended") {
      return res.status(409).json({ ok: false, error: "lease_restore_requires_ended_status" });
    }

    const propertyId = String(existingLease?.propertyId || "").trim();
    const unitId = String(existingLease?.unitId || existingLease?.unitNumber || "").trim();
    const tenantIds = Array.isArray(existingLease?.tenantIds)
      ? existingLease.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : [String(existingLease?.tenantId || existingLease?.primaryTenantId || "").trim()].filter(Boolean);
    const conflicts = await assertNoConflictingActiveAgreement({
      leaseId,
      excludeLeaseId: leaseId,
      landlordId,
      propertyId,
      unitId,
      tenantIds,
      startDate: String(existingLease?.startDate || "").trim() || null,
      endDate: null,
      monthlyRent:
        typeof existingLease?.monthlyRent === "number" ? existingLease.monthlyRent : Number(existingLease?.monthlyRent || 0) || null,
    });
    if (conflicts.length) {
      return res.status(409).json({
        ok: false,
        error: "conflicting_active_lease_agreement",
        conflictLeaseIds: conflicts.map((entry: any) => entry.lease.id),
      });
    }

    const currentUnitConflicts = await findCurrentLeaseConflictsForUnit({
      landlordId,
      propertyId,
      unitId: String(existingLease?.unitId || "").trim() || null,
      unitNumber: String(existingLease?.unitNumber || existingLease?.unit || "").trim() || null,
      excludeLeaseId: leaseId,
    });
    if (currentUnitConflicts.length) {
      return res.status(409).json({
        ok: false,
        error: "conflicting_active_lease_agreement",
        conflictLeaseIds: currentUnitConflicts.map((entry: any) => entry.id),
      });
    }

    try {
      await resolveRestoreUnitTargetsForLease(existingLease, "lease_restore");
    } catch (resolveErr: any) {
      console.error("[POST /api/leases/:id/restore-active] property unit resolution failed", {
        leaseId,
        landlordId,
        error: resolveErr?.message || String(resolveErr),
        code: resolveErr?.code || null,
      });
      return res.status(409).json({
        ok: false,
        error: "lease_restore_unit_reconciliation_failed",
      });
    }

    await db.collection("leases").doc(leaseId).set(
      {
        status: "active",
        endDate: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    try {
      await reconcilePropertyUnitOccupancyForLeaseRestore(existingLease);
    } catch (reconcileErr: any) {
      console.error("[POST /api/leases/:id/restore-active] occupancy reconciliation failed", {
        leaseId,
        landlordId,
        error: reconcileErr?.message || String(reconcileErr),
        code: reconcileErr?.code || null,
      });
      return res.status(409).json({
        ok: false,
        error: "lease_restore_unit_reconciliation_failed",
      });
    }
    const refreshed = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!refreshed.ok) return res.status(refreshed.status).json({ ok: false, error: refreshed.error });
    return res.status(200).json({
      ok: true,
      lease: await enrichLeaseRow({ id: leaseId, ...(refreshed.lease as any) }),
    });
  } catch (err) {
    console.error("[POST /api/leases/:id/restore-active] error", err);
    return res.status(500).json({ ok: false, error: "Failed to restore active lease" });
  }
});

router.get("/:leaseId/ledger", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });

    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const from = toIsoDate(req.query?.from) || null;
    const to = toIsoDate(req.query?.to) || null;
    const entries = await loadLedgerEntries(leaseId, landlordId, from, to);
    const paymentIntentLinks = await loadLeaseLedgerPaymentIntentLinks(leaseId, landlordId);
    const obligationRentPayments = await loadLeaseRentPaymentsForObligationLedger(leaseId, landlordId);
    const obligationPaymentIntents = await loadLeasePaymentIntentsForObligationLedger(leaseId, landlordId);
    const obligationReconciliationRecords = await loadLeaseReconciliationRecordsForObligationLedger({
      leaseId,
      paymentIntentIds: obligationPaymentIntents.map((record: any) => String(record?.paymentIntentId || "").trim()),
      rentPaymentIds: obligationRentPayments.map((record) => String(record?.id || "").trim()),
    });
    const obligationRows = buildPaymentObligationLedgerRows({
      leases: [
        {
          id: leaseId,
          ...(leaseCheck.lease as any),
          amountCents: normalizeLeaseRentAmountCents((leaseCheck.lease as any)?.monthlyRent),
          derivedLifecycleState: deriveLeaseLifecycleState({ id: leaseId, ...(leaseCheck.lease as any) }).state,
        },
      ],
      paymentIntents: obligationPaymentIntents as any,
      rentPayments: obligationRentPayments,
      reconciliationRecords: obligationReconciliationRecords,
    });
    const delinquencySignals = deriveDelinquencySignals(obligationRows);
    const decisionActions = await loadLeaseDecisionActions(leaseId);
    const leaseLifecycle = deriveLeaseLifecycleState({ id: leaseId, ...(leaseCheck.lease as any) });
    const decisions = applyDecisionActions(
      deriveDecisions({
        delinquencySignals,
        leaseLifecycle: {
          ...leaseLifecycle,
          leaseId,
          propertyId: String((leaseCheck.lease as any)?.propertyId || "").trim() || null,
          unitId: String((leaseCheck.lease as any)?.unitId || "").trim() || null,
          tenantId: String((leaseCheck.lease as any)?.tenantId || (leaseCheck.lease as any)?.primaryTenantId || "").trim() || null,
        },
        obligationRows,
      }),
      decisionActions
    );

    let runningBalanceCents = 0;
    const monthlyTotals: Record<string, { chargesCents: number; paymentsCents: number; netCents: number }> = {};
    const rows = entries.map((rawEntry: any) => {
      const entry = enrichLeaseLedgerEntryWithPaymentIntent(rawEntry, paymentIntentLinks);
      const signedAmountCents =
        entry.entryType === "payment"
          ? -Math.abs(Number(entry.amountCents || 0))
          : entry.entryType === "adjustment"
          ? Number(entry.amountCents || 0) // Adjustments can be positive or negative
          : Math.abs(Number(entry.amountCents || 0));
      runningBalanceCents += signedAmountCents;
      const monthKey = String(entry.effectiveDate || "").slice(0, 7);
      if (monthKey) {
        monthlyTotals[monthKey] ||= { chargesCents: 0, paymentsCents: 0, netCents: 0 };
        if (entry.entryType === "payment") {
          monthlyTotals[monthKey].paymentsCents += Math.abs(Number(entry.amountCents || 0));
        } else if (entry.entryType === "adjustment") {
          // Adjustments can be positive (charges) or negative (payment corrections)
          const adjustmentAmount = Number(entry.amountCents || 0);
          if (adjustmentAmount > 0) {
            monthlyTotals[monthKey].chargesCents += adjustmentAmount;
          } else {
            monthlyTotals[monthKey].paymentsCents += Math.abs(adjustmentAmount);
          }
        } else {
          monthlyTotals[monthKey].chargesCents += Math.abs(Number(entry.amountCents || 0));
        }
        monthlyTotals[monthKey].netCents =
          monthlyTotals[monthKey].chargesCents - monthlyTotals[monthKey].paymentsCents;
      }
      return {
        ...entry,
        signedAmountCents,
        balanceCents: runningBalanceCents,
      };
    });

    return res.json({
      ok: true,
      leaseId,
      entries: rows,
      totals: {
        chargesCents: rows
          .filter((row) => row.entryType === "charge")
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0) +
          rows
          .filter((row) => row.entryType === "adjustment" && Number(row.amountCents || 0) > 0)
          .reduce((sum, row) => sum + Number(row.amountCents || 0), 0),
        paymentsCents: rows
          .filter((row) => row.entryType === "payment")
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0) +
          rows
          .filter((row) => row.entryType === "adjustment" && Number(row.amountCents || 0) < 0)
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0),
        balanceCents: runningBalanceCents,
      },
      monthlyTotals,
      obligationRows,
      obligationSummary: summarizePaymentObligationLedger(obligationRows),
      delinquencySignals,
      delinquencySummary: summarizeDelinquencySignals(delinquencySignals),
      decisions,
    });
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/ledger] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load lease ledger" });
  }
});

router.post("/:leaseId/ledger/charge", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    const createdBy = req.user?.id || req.user?.email || landlordId;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const amountCents = cents(req.body?.amountCents);
    const effectiveDate = toIsoDate(req.body?.date || req.body?.effectiveDate);
    const category = String(req.body?.type || req.body?.category || "").trim().toLowerCase();
    if (!amountCents) return res.status(400).json({ ok: false, error: "amountCents must be a positive integer" });
    if (!effectiveDate) return res.status(400).json({ ok: false, error: "date is required" });
    if (!CHARGE_CATEGORIES.has(category)) {
      return res.status(400).json({ ok: false, error: "type must be rent|fee|adjustment" });
    }

    const lease = leaseCheck.lease as any;
    const now = Date.now();
    const entryRef = db.collection(LEDGER_COLLECTION).doc();
    const entry = {
      id: entryRef.id,
      landlordId,
      propertyId: String(req.body?.propertyId || lease?.propertyId || "").trim() || null,
      unitId:
        String(req.body?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null,
      leaseId,
      entryType: "charge" as LedgerEntryType,
      category,
      amountCents,
      effectiveDate,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      createdAt: now,
      createdBy,
    };
    await entryRef.set(entry, { merge: false });
    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/ledger/charge] error", err);
    return res.status(500).json({ ok: false, error: "Failed to add ledger charge" });
  }
});

router.post("/:leaseId/ledger/payment", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    const createdBy = req.user?.id || req.user?.email || landlordId;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const amountCents = cents(req.body?.amountCents);
    const effectiveDate = toIsoDate(req.body?.date || req.body?.effectiveDate);
    const method = String(req.body?.method || "").trim().toLowerCase();
    if (!amountCents) return res.status(400).json({ ok: false, error: "amountCents must be a positive integer" });
    if (!effectiveDate) return res.status(400).json({ ok: false, error: "date is required" });
    if (!PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ ok: false, error: "method must be cash|etransfer|cheque|bank|card|other" });
    }

    const lease = leaseCheck.lease as any;
    const tenantIds = Array.isArray(lease?.tenantIds) ? lease.tenantIds : [];
    const tenantId = String(lease?.tenantId || lease?.primaryTenantId || tenantIds[0] || "").trim();
    if (!tenantId) {
      return res.status(409).json({ ok: false, error: "Lease is missing tenant context" });
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const propertyId = String(req.body?.propertyId || lease?.propertyId || "").trim() || null;
    const unitId = String(req.body?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null;
    const paymentRef = db.collection("payments").doc();
    const entryRef = db.collection(LEDGER_COLLECTION).doc();
    const payment = {
      id: paymentRef.id,
      landlordId,
      tenantId,
      leaseId,
      propertyId,
      unitId,
      amount: amountCents / 100,
      amountCents,
      paidAt: effectiveDate,
      effectiveDate,
      method,
      status: "recorded",
      reference: req.body?.reference ? String(req.body.reference).trim().slice(0, 120) : null,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      ledgerEntryId: entryRef.id,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy,
    };
    const entry = {
      id: entryRef.id,
      landlordId,
      tenantId,
      propertyId,
      unitId,
      leaseId,
      entryType: "payment" as LedgerEntryType,
      category: "payment",
      amountCents,
      effectiveDate,
      method,
      reference: req.body?.reference ? String(req.body.reference).trim().slice(0, 120) : null,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      paymentDocumentId: paymentRef.id,
      createdAt: now,
      createdBy,
    };
    await db.runTransaction(async (transaction: any) => {
      transaction.set(paymentRef, payment, { merge: false });
      transaction.set(entryRef, entry, { merge: false });
    });
    return res.status(201).json({ ok: true, payment, entry });
  } catch (err) {
    console.error("[POST /api/leases/:leaseId/ledger/payment] error", err);
    return res.status(500).json({ ok: false, error: "Failed to record payment" });
  }
});

router.get("/:leaseId/ledger/export.csv", async (req: any, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const from = toIsoDate(req.query?.from) || null;
    const to = toIsoDate(req.query?.to) || null;
    const entries = await loadLedgerEntries(leaseId, landlordId, from, to);
    const labels = await resolveLeaseLedgerExportLabels(leaseCheck.lease);
    let runningBalance = 0;
    const header = [
      "date",
      "entryType",
      "category",
      "amountCents",
      "signedAmountCents",
      "balanceCents",
      "method",
      "reference",
      "notes",
      "property",
      "unit",
      "createdAt",
    ];
    const rows = entries.map((entry: any) => {
      const signed = entry.entryType === "payment"
        ? -Math.abs(Number(entry.amountCents || 0))
        : entry.entryType === "adjustment"
        ? Number(entry.amountCents || 0) // Adjustments can be positive or negative
        : Math.abs(Number(entry.amountCents || 0));
      runningBalance += signed;
      return [
        entry.effectiveDate,
        entry.entryType,
        entry.category,
        entry.amountCents,
        signed,
        runningBalance,
        entry.method || "",
        entry.reference || "",
        entry.notes || "",
        labels.property,
        labels.unit,
        entry.createdAt || "",
      ]
        .map(escapeCsvCell)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"lease-ledger-${leaseId}.csv\"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[GET /api/leases/:leaseId/ledger/export.csv] error", err);
    return res.status(500).json({ ok: false, error: "Failed to export lease ledger" });
  }
});

router.get("/:leaseId/ledger/export.pdf", async (req: any, res: Response) => {
  const startedAt = Date.now();
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const leaseId = String(req.params?.leaseId || "").trim();
    if (!leaseId) return res.status(400).json({ ok: false, error: "leaseId is required" });
    const leaseCheck = await getLeaseEntityForLandlord(leaseId, landlordId);
    if (!leaseCheck.ok) return res.status(leaseCheck.status).json({ ok: false, error: leaseCheck.error });

    const from = toIsoDate(req.query?.from) || null;
    const to = toIsoDate(req.query?.to) || null;
    const entries = await loadLedgerEntries(leaseId, landlordId, from, to);
    const labels = await resolveLeaseLedgerExportLabels(leaseCheck.lease);
    const pdf = await renderLeaseLedgerPdf({ leaseId, rows: entries, labels, from, to });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"lease-ledger-${leaseId}.pdf\"`
    );
    void recordPdfExportTelemetry({
      eventName: "pdf_export_completed",
      req,
      exportType: "lease_ledger",
      renderingPath: "backend_pdfkit",
      status: "completed",
      durationMs: Date.now() - startedAt,
      byteSize: pdf.byteLength,
    });
    return res.status(200).send(pdf);
  } catch (err) {
    void recordPdfExportTelemetry({
      eventName: "pdf_export_failed",
      req,
      exportType: "lease_ledger",
      renderingPath: "backend_pdfkit",
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: err instanceof Error ? err.message : "lease_ledger_pdf_failed",
    });
    console.error("[GET /api/leases/:leaseId/ledger/export.pdf] error", err);
    return res.status(500).json({ ok: false, error: "Failed to export lease ledger PDF" });
  }
});

export default router;




