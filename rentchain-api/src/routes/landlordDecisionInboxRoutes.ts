import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import { deriveDecisions, type Decision } from "../lib/decisions/decisionEngine";
import { applyDecisionActions, DECISION_ACTIONS_COLLECTION } from "../lib/decisions/decisionActions";
import { deriveLeaseLifecycleState } from "../lib/leases/leaseLifecycle";
import { buildPaymentObligationLedgerRows } from "../lib/payments/paymentObligationLedger";
import { deriveDelinquencySignals } from "../lib/payments/delinquencySignals";
import type { RentPaymentRecord } from "../services/rentPayments/rentPaymentService";

const router = Router();

function asString(value: unknown, max = 1000) {
  const next = String(value ?? "").trim().slice(0, max);
  return next || "";
}

function normalizeLeaseRentAmountCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

async function loadLandlordLeases(landlordId: string) {
  const byId = new Map<string, any>();
  async function collect(field: "landlordId" | "ownerId" | "userId") {
    const snap = await db.collection("leases").where(field, "==", landlordId).get().catch(() => null);
    for (const doc of snap?.docs || []) {
      byId.set(doc.id, { id: doc.id, ...((doc.data() as any) || {}) });
    }
  }
  await Promise.all([collect("landlordId"), collect("ownerId"), collect("userId")]);
  return Array.from(byId.values()).filter((lease) => {
    return [lease?.landlordId, lease?.ownerId, lease?.userId].some((value) => asString(value, 240) === landlordId);
  });
}

async function loadLeaseRentPayments(leaseId: string, landlordId: string): Promise<RentPaymentRecord[]> {
  const snap = await db.collection("rentPayments").where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => asString(record?.landlordId, 240) === landlordId)
    .map((record: any) => ({
      id: asString(record?.id || record?.rentPaymentId || record?.paymentId || docId(record), 240),
      leaseId: asString(record?.leaseId, 240),
      tenantId: asString(record?.tenantId, 240),
      landlordId: asString(record?.landlordId, 240),
      propertyId: asString(record?.propertyId, 240) || null,
      unitId: asString(record?.unitId, 240) || null,
      paymentIntentId: asString(record?.paymentIntentId, 240) || null,
      amountCents: Math.max(0, Math.round(Number(record?.amountCents || 0))),
      currency: "cad" as const,
      status: asString(record?.status || "setup_required", 80) as RentPaymentRecord["status"],
      processor: "stripe" as const,
      processorCheckoutSessionId: asString(record?.processorCheckoutSessionId, 240) || null,
      processorPaymentIntentId: asString(record?.processorPaymentIntentId, 240) || null,
      createdAt: asString(record?.createdAt, 120),
      updatedAt: asString(record?.updatedAt, 120),
      paidAt: asString(record?.paidAt, 120) || null,
    }));
}

function docId(record: any) {
  return asString(record?.id, 240);
}

async function loadLeasePaymentIntents(leaseId: string, landlordId: string) {
  const snap = await db.collection("paymentIntents").where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ paymentIntentId: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => asString(record?.landlordId, 240) === landlordId);
}

async function loadLeaseReconciliationRecords(params: {
  leaseId: string;
  paymentIntentIds: string[];
  rentPaymentIds: string[];
}) {
  const records = new Map<string, any>();
  async function collect(field: string, value: string) {
    const normalized = asString(value, 240);
    if (!normalized) return;
    const snap = await db.collection("paymentReconciliationRecords").where(field, "==", normalized).get().catch(() => null);
    for (const doc of snap?.docs || []) {
      records.set(doc.id, { reconciliationId: doc.id, ...((doc.data() as any) || {}) });
    }
  }
  await collect("leaseId", params.leaseId);
  await collect("subjectId", params.leaseId);
  for (const paymentIntentId of params.paymentIntentIds) await collect("paymentIntentId", paymentIntentId);
  for (const rentPaymentId of params.rentPaymentIds) {
    await collect("rentPaymentId", rentPaymentId);
    await collect("subjectId", rentPaymentId);
  }
  return Array.from(records.values());
}

async function loadDecisionActionsForLease(leaseId: string) {
  const snap = await db.collection(DECISION_ACTIONS_COLLECTION).where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

async function deriveLeaseDecisionsForInbox(landlordId: string): Promise<Decision[]> {
  const leases = await loadLandlordLeases(landlordId);
  const nested = await Promise.all(
    leases.map(async (lease) => {
      const leaseId = asString(lease?.id, 240);
      if (!leaseId) return [];
      const [rentPayments, paymentIntents, actions] = await Promise.all([
        loadLeaseRentPayments(leaseId, landlordId),
        loadLeasePaymentIntents(leaseId, landlordId),
        loadDecisionActionsForLease(leaseId),
      ]);
      const reconciliationRecords = await loadLeaseReconciliationRecords({
        leaseId,
        paymentIntentIds: paymentIntents.map((record: any) => asString(record?.paymentIntentId, 240)).filter(Boolean),
        rentPaymentIds: rentPayments.map((record) => asString(record?.id, 240)).filter(Boolean),
      });
      const lifecycle = deriveLeaseLifecycleState({ id: leaseId, ...lease });
      const obligationRows = buildPaymentObligationLedgerRows({
        leases: [
          {
            ...lease,
            id: leaseId,
            amountCents: normalizeLeaseRentAmountCents(lease?.monthlyRent),
            derivedLifecycleState: lifecycle.state,
          },
        ],
        paymentIntents,
        rentPayments,
        reconciliationRecords,
      });
      const delinquencySignals = deriveDelinquencySignals(obligationRows);
      const decisions = deriveDecisions({
        delinquencySignals,
        leaseLifecycle: {
          ...lifecycle,
          leaseId,
          propertyId: asString(lease?.propertyId, 240) || null,
          unitId: asString(lease?.unitId, 240) || null,
          tenantId: asString(lease?.tenantId || lease?.primaryTenantId, 240) || null,
        },
        obligationRows,
      });
      return applyDecisionActions(decisions, actions);
    })
  );
  return nested.flat();
}

router.get("/decision-inbox", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const [snapshot, leaseDecisions] = await Promise.all([
      loadLandlordAnalyticsSnapshot({
        landlordId,
        period: req.query?.period,
        propertyId: req.query?.propertyId,
      }),
      deriveLeaseDecisionsForInbox(landlordId),
    ]);

    const inbox = deriveDecisionInbox({
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
      filters: {
        severity: req.query?.severity,
        status: req.query?.status,
        type: req.query?.type,
        queue: req.query?.queue,
        workflowState: req.query?.workflowState,
        escalationLevel: req.query?.escalationLevel,
      },
    });

    return res.json({ ok: true, ...inbox });
  } catch (err: any) {
    console.error("[landlord-decision-inbox] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "DECISION_INBOX_FAILED" });
  }
});

export default router;
