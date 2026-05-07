import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveRentalDebtProfile } from "../lib/rentalDebt/deriveRentalDebtProfile";
import type { RentalDebtProfile, RentalDebtStatus } from "../lib/rentalDebt/rentalDebtTypes";

const router = Router();
const STATUSES = new Set<RentalDebtStatus>(["verified", "partially_verified", "review_required", "blocked", "unknown"]);

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
    "paymentStatus",
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
    "paymentDefaultId",
    "delinquencyId",
    "ledgerEventId",
    "paymentId",
    "rentPaymentId",
    "disputeId",
    "disputeGovernanceId",
    "caseId",
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

function debtLike(record: Record<string, any>) {
  const fields = [record.status, record.state, record.conclusion, record.paymentStatus, record.type, record.eventType, record.domain]
    .map((value) => asString(value, 120).toLowerCase())
    .join(" ");
  return /\b(default|delinquen|past_due|overdue|arrears|missed|failed|late)\b/.test(fields);
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

async function buildRentalDebtProfiles(landlordId: string, requestedTenantId?: string): Promise<RentalDebtProfile[]> {
  const [
    ledgerEvents,
    rentPayments,
    delinquencyRecords,
    disputeRecords,
    consentRecords,
    reviewRecords,
    evidencePacks,
    events,
  ] = await Promise.all([
    loadLandlordCollection("ledgerEvents", landlordId),
    loadLandlordCollection("rentPayments", landlordId),
    Promise.all([
      loadLandlordCollection("delinquencyRecords", landlordId),
      loadLandlordCollection("rentalDebtReadiness", landlordId),
      loadLandlordCollection("rentalDebtProfiles", landlordId),
    ]).then((groups) => groups.flat()),
    Promise.all([
      loadLandlordCollection("disputeResolutionReadiness", landlordId),
      loadLandlordCollection("disputeGovernance", landlordId),
    ]).then((groups) => groups.flat()),
    Promise.all([loadLandlordCollection("consents", landlordId), loadLandlordCollection("consentGovernance", landlordId)]).then((groups) => groups.flat()),
    loadLandlordCollection("operatorReviewSessions", landlordId),
    loadLandlordCollection("evidencePacks", landlordId),
    loadLandlordCollection("events", landlordId),
  ]);

  const paymentDefaultRecords = [...ledgerEvents, ...rentPayments].filter(debtLike);
  const debtRecords = [...paymentDefaultRecords, ...delinquencyRecords, ...disputeRecords, ...consentRecords, ...reviewRecords, ...evidencePacks, ...events];
  const tenantIds = requestedTenantId ? [requestedTenantId] : collectTenantIds(debtRecords);

  return tenantIds.map((tenantId) =>
    deriveRentalDebtProfile({
      landlordId,
      tenantId,
      paymentDefaultRecords: filterByTenant(paymentDefaultRecords, tenantId),
      delinquencyRecords: filterByTenant(delinquencyRecords, tenantId),
      disputeRecords: filterByTenant(disputeRecords, tenantId),
      consentRecords: filterByTenant(consentRecords, tenantId),
      reviewRecords: filterByTenant(reviewRecords, tenantId),
      evidencePacks: filterByTenant(evidencePacks, tenantId),
      auditEvents: filterByTenant(events, tenantId),
    })
  );
}

router.get("/rental-debt", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const tenantId = asString(req.query?.tenantId, 240);
    const status = asString(req.query?.status, 80) as RentalDebtStatus;
    let profiles = await buildRentalDebtProfiles(landlordId, tenantId || undefined);
    if (status && STATUSES.has(status)) profiles = profiles.filter((profile) => profile.status === status);
    return res.json({ ok: true, profiles });
  } catch (err: any) {
    console.error("[landlord-rental-debt] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_DEBT_FAILED" });
  }
});

router.get("/rental-debt/:rentalDebtId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const rentalDebtId = decodeURIComponent(asString(req.params?.rentalDebtId, 500));
    if (!landlordId || !rentalDebtId) return res.status(400).json({ ok: false, error: "RENTAL_DEBT_ID_REQUIRED" });
    const profiles = await buildRentalDebtProfiles(landlordId);
    const profile = profiles.find((item) => item.rentalDebtId === rentalDebtId);
    if (!profile) return res.status(404).json({ ok: false, error: "RENTAL_DEBT_NOT_FOUND" });
    return res.json({ ok: true, profile });
  } catch (err: any) {
    console.error("[landlord-rental-debt] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_DEBT_GET_FAILED" });
  }
});

export default router;
