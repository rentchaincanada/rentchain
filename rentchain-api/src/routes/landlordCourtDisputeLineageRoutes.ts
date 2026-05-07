import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveCourtDisputeLineageProfile } from "../lib/courtDisputeLineage/deriveCourtDisputeLineageProfile";
import type {
  CourtDisputeLineageProfile,
  CourtDisputeLineageStatus,
} from "../lib/courtDisputeLineage/courtDisputeLineageTypes";

const router = Router();
const STATUSES = new Set<CourtDisputeLineageStatus>(["verified", "partially_verified", "review_required", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

function sanitizeRecord(record: Record<string, any>) {
  const safe: Record<string, any> = {};
  for (const key of [
    "id",
    "status",
    "state",
    "conclusion",
    "recordStatus",
    "type",
    "eventType",
    "domain",
    "landlordId",
    "ownerId",
    "userId",
    "tenantId",
    "tenantIds",
    "primaryTenantId",
    "applicantTenantId",
    "identityId",
    "resourceId",
    "scopeId",
    "leaseId",
    "propertyId",
    "disputeId",
    "disputeGovernanceId",
    "caseId",
    "courtRecordId",
    "courtReferenceId",
    "filingReadinessId",
    "courtFilingReadinessId",
    "judgmentOrderId",
    "orderReferenceId",
    "rentalDebtId",
    "debtReferenceId",
    "consentId",
    "consentGovernanceId",
    "identityConsentId",
    "reviewSessionId",
    "operatorReviewId",
    "evidencePackId",
    "eventId",
    "createdAt",
    "updatedAt",
    "occurredAt",
    "redacted",
  ]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

function belongsToLandlord(record: Record<string, any>, landlordId: string) {
  return [record.landlordId, record.ownerId, record.userId].map((value) => asString(value, 240)).includes(landlordId);
}

function tenantIdsFor(record: Record<string, any>) {
  const tenantIds = Array.isArray(record.tenantIds) ? record.tenantIds.map((item) => asString(item, 240)) : [];
  return [record.tenantId, record.primaryTenantId, record.applicantTenantId, record.identityId, record.resourceId, record.scopeId]
    .map((value) => asString(value, 240).replace(/^tenant:/, ""))
    .concat(tenantIds)
    .filter(Boolean);
}

function filterByTenant(records: Record<string, any>[], tenantId: string) {
  return records.filter((record) => tenantIdsFor(record).includes(tenantId));
}

function filterByDispute(records: Record<string, any>[], disputeId: string) {
  return records.filter((record) => [record.disputeId, record.disputeGovernanceId, record.caseId, record.resourceId, record.scopeId, record.id].map((value) => asString(value, 240)).includes(disputeId));
}

async function loadLandlordCollection(collectionName: string, landlordId: string, limit = 50) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) byId.set(doc.id, sanitizeRecord({ id: doc.id, ...((doc.data() as any) || {}) }));
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId")]);
  return Array.from(byId.values()).filter((record) => belongsToLandlord(record, landlordId)).slice(0, limit);
}

function collectTenantIds(records: Record<string, any>[]) {
  const tenantIds = new Set<string>();
  for (const record of records) {
    for (const tenantId of tenantIdsFor(record)) tenantIds.add(tenantId);
  }
  return Array.from(tenantIds).sort((a, b) => a.localeCompare(b));
}

async function buildCourtDisputeLineageProfiles(input: {
  landlordId: string;
  tenantId?: string;
  disputeId?: string;
}): Promise<CourtDisputeLineageProfile[]> {
  const [
    disputeRecords,
    courtRecordReferences,
    filingReadinessReferences,
    judgmentOrderReferences,
    rentalDebtReferences,
    consentRecords,
    reviewRecords,
    evidencePacks,
    events,
  ] = await Promise.all([
    Promise.all([
      loadLandlordCollection("disputeResolutionReadiness", input.landlordId),
      loadLandlordCollection("disputeGovernance", input.landlordId),
      loadLandlordCollection("courtDisputeLineage", input.landlordId),
    ]).then((groups) => groups.flat()),
    loadLandlordCollection("courtRecordReferences", input.landlordId),
    loadLandlordCollection("courtFilingReadiness", input.landlordId),
    loadLandlordCollection("judgmentOrderReferences", input.landlordId),
    loadLandlordCollection("rentalDebtProfiles", input.landlordId),
    Promise.all([loadLandlordCollection("consents", input.landlordId), loadLandlordCollection("consentGovernance", input.landlordId)]).then((groups) => groups.flat()),
    loadLandlordCollection("operatorReviewSessions", input.landlordId),
    loadLandlordCollection("evidencePacks", input.landlordId),
    loadLandlordCollection("events", input.landlordId),
  ]);

  const allRecords = [
    ...disputeRecords,
    ...courtRecordReferences,
    ...filingReadinessReferences,
    ...judgmentOrderReferences,
    ...rentalDebtReferences,
    ...consentRecords,
    ...reviewRecords,
    ...evidencePacks,
    ...events,
  ];
  const tenantIds = input.tenantId ? [input.tenantId] : collectTenantIds(allRecords);

  return tenantIds.map((tenantId) => {
    const scopedDisputes = input.disputeId ? filterByDispute(filterByTenant(disputeRecords, tenantId), input.disputeId) : filterByTenant(disputeRecords, tenantId);
    return deriveCourtDisputeLineageProfile({
      landlordId: input.landlordId,
      tenantId,
      disputeRecords: scopedDisputes,
      courtRecordReferences: input.disputeId ? filterByDispute(filterByTenant(courtRecordReferences, tenantId), input.disputeId) : filterByTenant(courtRecordReferences, tenantId),
      filingReadinessReferences: input.disputeId ? filterByDispute(filterByTenant(filingReadinessReferences, tenantId), input.disputeId) : filterByTenant(filingReadinessReferences, tenantId),
      judgmentOrderReferences: input.disputeId ? filterByDispute(filterByTenant(judgmentOrderReferences, tenantId), input.disputeId) : filterByTenant(judgmentOrderReferences, tenantId),
      rentalDebtReferences: filterByTenant(rentalDebtReferences, tenantId),
      consentRecords: filterByTenant(consentRecords, tenantId),
      reviewRecords: filterByTenant(reviewRecords, tenantId),
      evidencePacks: filterByTenant(evidencePacks, tenantId),
      auditEvents: filterByTenant(events, tenantId),
    });
  });
}

router.get("/court-dispute-lineage", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const tenantId = asString(req.query?.tenantId, 240);
    const disputeId = asString(req.query?.disputeId, 240);
    const status = asString(req.query?.status, 80) as CourtDisputeLineageStatus;
    let profiles = await buildCourtDisputeLineageProfiles({ landlordId, tenantId: tenantId || undefined, disputeId: disputeId || undefined });
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[landlord-court-dispute-lineage] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "COURT_DISPUTE_LINEAGE_FAILED" });
  }
});

router.get("/court-dispute-lineage/:courtDisputeLineageId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const courtDisputeLineageId = decodeURIComponent(asString(req.params?.courtDisputeLineageId, 500));
    if (!landlordId || !courtDisputeLineageId) return res.status(400).json({ ok: false, error: "COURT_DISPUTE_LINEAGE_ID_REQUIRED" });
    const profiles = await buildCourtDisputeLineageProfiles({ landlordId });
    const profile = profiles.find((item) => item.courtDisputeLineageId === courtDisputeLineageId);
    if (!profile) return res.status(404).json({ ok: false, error: "COURT_DISPUTE_LINEAGE_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[landlord-court-dispute-lineage] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "COURT_DISPUTE_LINEAGE_GET_FAILED" });
  }
});

export default router;
