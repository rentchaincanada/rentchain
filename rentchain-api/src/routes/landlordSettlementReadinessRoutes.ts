import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveSettlementReadiness } from "../lib/settlementReadiness/deriveSettlementReadiness";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import type { SettlementReadiness, SettlementReadinessStatus } from "../lib/settlementReadiness/settlementReadinessTypes";

const router = Router();

const STATUSES = new Set<SettlementReadinessStatus>(["ready_for_review", "partially_ready", "blocked", "unknown"]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240);
}

async function loadLandlordCollection(collectionName: string, landlordId: string) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId") {
    const snap = await db.collection(collectionName).where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) {
      byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
    }
  }

  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId")]);

  return Array.from(byId.values()).filter((record) =>
    [record?.landlordId, record?.ownerId, record?.userId].some((value) => asString(value, 240) === landlordId)
  );
}

function filterContext(records: any[], filters: { propertyId: string; leaseId: string }) {
  return records.filter((record) => {
    if (filters.leaseId) {
      return (
        asString(record?.id || record?.leaseId || record?.leaseID, 240) === filters.leaseId ||
        asString(record?.leaseId, 240) === filters.leaseId ||
        asString(record?.scopeId, 240) === filters.leaseId
      );
    }
    if (filters.propertyId) {
      return (
        asString(record?.propertyId || record?.id, 240) === filters.propertyId ||
        asString(record?.scopeId, 240) === filters.propertyId
      );
    }
    return true;
  });
}

async function loadLandlordDecisionItems(landlordId: string) {
  const analyticsDecisions = new Map<string, any>();
  async function collectAnalytics(collectionName: string) {
    const records = await loadLandlordCollection(collectionName, landlordId).catch(() => []);
    for (const record of records) {
      const decisions = Array.isArray(record?.decisions?.items)
        ? record.decisions.items
        : Array.isArray(record?.decisions)
          ? record.decisions
          : [];
      for (const decision of decisions) {
        const id = asString(decision?.id || decision?.decisionId, 600);
        if (id) analyticsDecisions.set(id, decision);
      }
    }
  }
  await Promise.all([collectAnalytics("landlordAnalyticsSnapshots"), collectAnalytics("analyticsSnapshots")]);
  return deriveDecisionInbox({ analyticsDecisions: Array.from(analyticsDecisions.values()) }).items;
}

function settlementMatches(readiness: SettlementReadiness, settlementReadinessId: string) {
  return readiness.settlementReadinessId === settlementReadinessId;
}

async function buildReadinessItems(landlordId: string, filters: { propertyId: string; leaseId: string }) {
  const [leasesRaw, paymentIntentsRaw, rentPaymentsRaw, reconciliationRaw, evidencePacksRaw, reviewsRaw, eventsRaw, decisions] =
    await Promise.all([
      loadLandlordCollection("leases", landlordId),
      loadLandlordCollection("paymentIntents", landlordId),
      loadLandlordCollection("rentPayments", landlordId),
      loadLandlordCollection("paymentReconciliationRecords", landlordId),
      loadLandlordCollection("evidencePacks", landlordId),
      loadLandlordCollection("operatorReviewSessions", landlordId),
      loadLandlordCollection("events", landlordId),
      loadLandlordDecisionItems(landlordId),
    ]);

  const leases = filterContext(leasesRaw, filters);
  const leaseIds = new Set(leases.map((lease) => asString(lease.id || lease.leaseId, 240)).filter(Boolean));
  const scopeFilters = {
    propertyId: filters.propertyId,
    leaseId: filters.leaseId || "",
  };
  const scopedPaymentIntents = filterContext(paymentIntentsRaw, scopeFilters).filter(
    (intent) => !filters.leaseId || leaseIds.has(asString(intent.leaseId, 240)) || asString(intent.leaseId, 240) === filters.leaseId
  );
  const scopedRentPayments = filterContext(rentPaymentsRaw, scopeFilters).filter(
    (payment) => !filters.leaseId || leaseIds.has(asString(payment.leaseId, 240)) || asString(payment.leaseId, 240) === filters.leaseId
  );
  const scopedReconciliation = filterContext(reconciliationRaw, scopeFilters);
  const scopedEvidence = filterContext(evidencePacksRaw, scopeFilters);
  const scopedReviews = filterContext(reviewsRaw, scopeFilters);
  const scopedEvents = filterContext(eventsRaw, scopeFilters);
  const obligationRows = buildPaymentObligationLedgerRows({
    leases,
    paymentIntents: scopedPaymentIntents,
    rentPayments: scopedRentPayments,
    reconciliationRecords: scopedReconciliation,
  });

  const readiness = deriveSettlementReadiness({
    landlordId,
    propertyId: filters.propertyId,
    leaseId: filters.leaseId,
    obligationRows,
    reconciliationRecords: scopedReconciliation,
    evidencePacks: scopedEvidence,
    operatorReviewSessions: scopedReviews,
    auditEvents: scopedEvents,
    decisions,
  });

  return [readiness];
}

router.get("/settlement-readiness", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const propertyId = asString(req.query?.propertyId, 240);
    const leaseId = asString(req.query?.leaseId, 240);
    const status = asString(req.query?.status, 80) as SettlementReadinessStatus;
    let readiness = await buildReadinessItems(landlordId, { propertyId, leaseId });
    if (status && STATUSES.has(status)) readiness = readiness.filter((item) => item.status === status);
    return res.json({ ok: true, readiness });
  } catch (err: any) {
    console.error("[landlord-settlement-readiness] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SETTLEMENT_READINESS_FAILED" });
  }
});

router.get("/settlement-readiness/:settlementReadinessId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = landlordIdFromReq(req);
    const settlementReadinessId = decodeURIComponent(asString(req.params?.settlementReadinessId, 500));
    if (!landlordId || !settlementReadinessId) return res.status(400).json({ ok: false, error: "SETTLEMENT_READINESS_ID_REQUIRED" });
    const readiness = await buildReadinessItems(landlordId, { propertyId: "", leaseId: "" });
    const item = readiness.find((next) => settlementMatches(next, settlementReadinessId));
    if (!item) return res.status(404).json({ ok: false, error: "SETTLEMENT_READINESS_NOT_FOUND" });
    return res.json({ ok: true, readiness: item });
  } catch (err: any) {
    console.error("[landlord-settlement-readiness] get failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SETTLEMENT_READINESS_GET_FAILED" });
  }
});

export default router;
