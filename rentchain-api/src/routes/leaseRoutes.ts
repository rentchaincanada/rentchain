import { Router, Request, Response } from "express";
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
import { CURRENT_LEASE_STATUSES, loadCanonicalPropertyLeases, loadUnitsForProperty, toCanonicalLeaseRecord } from "../services/leaseCanonicalizationService";
import { evaluateSameLeaseAgreement, groupLeaseAgreementCandidates, pickAgreementWinner } from "../services/leasePartyConsolidationService";
import { loadPropertyLeaseIntegrityDiagnostics } from "../services/leaseIntegrityService";
import { buildLeaseRiskPersistenceFields, computeLeaseRiskSnapshot } from "../services/risk/recomputeLeaseRisk";
import { loadPropertyCredibilitySummary } from "../services/risk/propertyCredibilitySummary";
import { dedupePropertyScopedLeasesByUnit, filterPropertyScopedLeases } from "../services/risk/propertyLeaseIsolation";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";
import {
  isTargetedHiddenLeaseId,
  isTargetedHiddenTenantId,
} from "../lib/testDataVisibilityTargets";
import { deriveTenantSafeLeaseReadinessMetadata } from "../services/tenantPortal/tenantProjectionService";

const router = Router();
const LEDGER_COLLECTION = "ledgerEntries";
const LEASE_NOTES_COLLECTION = "leaseNotes";
const PAYMENT_METHODS = new Set(["cash", "etransfer", "cheque", "bank", "card", "other"]);
const CHARGE_CATEGORIES = new Set(["rent", "fee", "adjustment"]);

type LedgerEntryType = "charge" | "payment";
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

  return {
    ...lease,
    propertyName,
    tenantName,
    tenantEmail,
    documentUrl,
    ...deriveTenantSafeLeaseReadinessMetadata(raw, { documentUrl, leaseId: lease.id }),
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

  const leases = await Promise.all(filtered.map((row: any) => enrichLeaseRow(row)));
  return mergeLeaseRows(leases);
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
    .filter((doc: any) => String(doc.id || "") !== String(input.leaseId || ""))
    .map((doc: any) => ({ raw: doc.data() as any, lease: toCanonicalLeaseRecord(doc.id, doc.data() as any, units) }))
    .filter((entry: any) => CURRENT_LEASE_STATUSES.has(String(entry.lease.status || "").trim().toLowerCase()));

  return existing.filter((entry: any) => {
    const result = evaluateSameLeaseAgreement(candidate as any, entry as any);
    return result.decision === "merge" || result.decision === "ambiguous";
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
    return res.status(201).json({
      ok: true,
      lease: enrichedLease,
      tenant: { id: tenantRef.id, fullName: occupantName, email: tenantEmail, phone: tenantPhone },
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
    const snapshotDoc = {
      ...draft,
      status: "generated",
      generatedAt: now,
      generatedFiles: [file],
    };
    await snapshotRef.set(snapshotDoc, { merge: false });

    await ref.set(
      {
        ...draft,
        status: "generated",
        updatedAt: now,
        lastGeneratedSnapshotId: snapshotRef.id,
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
      generatedFiles: [file],
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

    if (String(draft?.leaseId || "").trim()) {
      const existingLeaseId = String(draft.leaseId).trim();
      const existingLeaseSnap = await db.collection("leases").doc(existingLeaseId).get();
      if (existingLeaseSnap.exists) {
        return res.status(200).json({
          ok: true,
          leaseId: existingLeaseId,
          lease: { id: existingLeaseId, ...(existingLeaseSnap.data() as any) },
        });
      }
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
    await leaseRef.set(leaseRecord, { merge: false });

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

    return res.status(200).json({
      ok: true,
      leaseId: leaseRef.id,
      lease: { id: leaseRef.id, ...leaseRecord },
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

router.post("/:id/automation/tasks/regenerate", requireLandlord, (req: any, res: Response) => {
  const lease = leaseService.getById(String(req.params?.id || "").trim());
  if (!lease) {
    return res.status(404).json({ ok: false, error: "Lease not found" });
  }
  const tasks = regenerateLeaseAutomationTasks({
    id: lease.id,
    startDate: lease.startDate,
    endDate: lease.endDate || null,
    automationEnabled: (lease as any).automationEnabled,
    renewalStatus: (lease as any).renewalStatus,
  });
  return res.status(200).json({ ok: true, tasks });
});

router.get("/:id/automation/tasks", requireLandlord, (req: any, res: Response) => {
  const lease = leaseService.getById(String(req.params?.id || "").trim());
  if (!lease) {
    return res.status(404).json({ ok: false, error: "Lease not found" });
  }
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
      .map((doc: any) => normalizeLeaseRow(doc.id, doc.data() as any))
      .filter((lease: any) => !landlordId || String(lease.landlordId || "").trim() === landlordId)
      .map(({ landlordId: _landlordId, ...lease }: any) => lease);
    return res.status(200).json({ ok: true, leases: mergeLeaseRows([...memoryLeases, ...firestoreLeases]) });
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
    const response: any = { leases: summaryLeases };
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

    const conflicts = await assertNoConflictingActiveAgreement({
      landlordId,
      propertyId: body.propertyId,
      unitId: body.unitNumber,
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
      unitId: body.unitNumber,
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
      unitNumber: body.unitNumber,
      monthlyRent: Number(body.monthlyRent),
      startDate: body.startDate,
      endDate: body.endDate,
      risk: riskFields.risk,
      riskTimeline: riskFields.riskTimeline,
    };

    const lease = leaseService.create(payload);
    if (landlordId) {
      const firestoreLeaseRecord = {
        landlordId,
        tenantId: lease.tenantId,
        tenantIds,
        primaryTenantId: tenantIds[0] || body.tenantId,
        propertyId: lease.propertyId,
        unitId: body.unitNumber,
        unitNumber: lease.unitNumber,
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
      await db.collection("leases").doc(lease.id).set(firestoreLeaseRecord, { merge: false }).catch((error: any) => {
        console.warn("[POST /api/leases] firestore lease write failed", error);
      });
    }
    res.status(201).json({ lease });
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

    let runningBalanceCents = 0;
    const monthlyTotals: Record<string, { chargesCents: number; paymentsCents: number; netCents: number }> = {};
    const rows = entries.map((entry: any) => {
      const signedAmountCents =
        entry.entryType === "payment" ? -Math.abs(Number(entry.amountCents || 0)) : Math.abs(Number(entry.amountCents || 0));
      runningBalanceCents += signedAmountCents;
      const monthKey = String(entry.effectiveDate || "").slice(0, 7);
      if (monthKey) {
        monthlyTotals[monthKey] ||= { chargesCents: 0, paymentsCents: 0, netCents: 0 };
        if (entry.entryType === "payment") {
          monthlyTotals[monthKey].paymentsCents += Math.abs(Number(entry.amountCents || 0));
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
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0),
        paymentsCents: rows
          .filter((row) => row.entryType === "payment")
          .reduce((sum, row) => sum + Math.abs(Number(row.amountCents || 0)), 0),
        balanceCents: runningBalanceCents,
      },
      monthlyTotals,
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
    const now = Date.now();
    const entryRef = db.collection(LEDGER_COLLECTION).doc();
    const entry = {
      id: entryRef.id,
      landlordId,
      propertyId: String(req.body?.propertyId || lease?.propertyId || "").trim() || null,
      unitId:
        String(req.body?.unitId || lease?.unitId || lease?.unitNumber || "").trim() || null,
      leaseId,
      entryType: "payment" as LedgerEntryType,
      category: "payment",
      amountCents,
      effectiveDate,
      method,
      reference: req.body?.reference ? String(req.body.reference).trim().slice(0, 120) : null,
      notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 5000) : null,
      createdAt: now,
      createdBy,
    };
    await entryRef.set(entry, { merge: false });
    return res.status(201).json({ ok: true, entry });
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
      "propertyId",
      "unitId",
      "createdAt",
    ];
    const rows = entries.map((entry: any) => {
      const signed = entry.entryType === "payment" ? -Math.abs(Number(entry.amountCents || 0)) : Math.abs(Number(entry.amountCents || 0));
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
        entry.propertyId || "",
        entry.unitId || "",
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

export default router;





