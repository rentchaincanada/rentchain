import { Router, Response } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { deriveDecisions, type Decision } from "../lib/decisions/decisionEngine";
import {
  applyDecisionActions,
  buildDecisionAction,
  DECISION_ACTIONS_COLLECTION,
  decisionActionRecordId,
  parseDecisionActionPatch,
} from "../lib/decisions/decisionActions";
import { deriveLeaseLifecycleState } from "../lib/leases/leaseLifecycle";
import {
  buildPaymentObligationLedgerRows,
  summarizePaymentObligationLedger,
} from "../lib/payments/paymentObligationLedger";
import {
  deriveDelinquencySignals,
  summarizeDelinquencySignals,
} from "../lib/payments/delinquencySignals";
import type { RentPaymentRecord } from "../services/rentPayments/rentPaymentService";
import { computeDecisionState } from "../services/stateMachines/stateComputation";
import { decisionStateMachine } from "../services/stateMachines/decisionStateMachine";
import { appendProvenanceEvent } from "../services/stateMachines/provenanceStorage";
import { buildValidationSummary, validateDecisionTransition } from "../services/stateMachines/transitionValidation";
import { appendReviewStateTransitionAuditEvent } from "../lib/canonicalAudit/reviewStateTransitionAudit";
import type { DecisionActionState, DecisionEvent } from "../services/stateMachines/types";

const router = Router();

function asString(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function isAdmin(req: any) {
  const role = asString(req.user?.role, 80).toLowerCase();
  return role === "admin" || role === "system.admin";
}

function landlordIdFromReq(req: any) {
  return asString(req.user?.landlordId || req.user?.id || req.user?.sub, 240) || null;
}

function actorIdFromReq(req: any) {
  return asString(req.user?.uid || req.user?.id || req.user?.sub, 240) || null;
}

function actorEmailFromReq(req: any) {
  return asString(req.user?.email, 320) || null;
}

function isActiveDecisionStatus(status: unknown) {
  const normalized = asString(status || "detected", 40);
  return !["reviewed", "snoozed", "accepted", "dismissed", "resolved"].includes(normalized);
}

function logDecisionStateMarkers(actions: Array<Record<string, unknown>>) {
  if (process.env.STATE_MACHINE_DEBUG !== "1") return;
  const counts = new Map<string, number>();
  for (const action of actions) {
    const state = computeDecisionState(action);
    counts.set(state, (counts.get(state) || 0) + 1);
    if (!decisionStateMachine.states.includes(state)) {
      console.warn("[state-machine] decision advisory invalid", { route: "decision_list" });
    }
  }
  console.info("[state-machine] decision advisory", { count: actions.length, states: Object.fromEntries(counts) });
}

async function loadLeaseForDecisionAccess(req: any, leaseId: string) {
  const snap = await db.collection("leases").doc(leaseId).get();
  if (!snap.exists) return { ok: false as const, status: 404, error: "decision_lease_not_found" };
  const lease = { id: snap.id, ...((snap.data() as any) || {}) };
  const leaseLandlordId = asString((lease as any).landlordId, 240);
  if (!isAdmin(req) && leaseLandlordId !== landlordIdFromReq(req)) {
    return { ok: false as const, status: 403, error: "decision_forbidden" };
  }
  return { ok: true as const, lease, landlordId: leaseLandlordId || landlordIdFromReq(req) };
}

function normalizeLeaseRentAmountCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

async function loadLeaseRentPayments(leaseId: string, landlordId: string | null): Promise<RentPaymentRecord[]> {
  const snap = await db.collection("rentPayments").where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => !landlordId || asString(record?.landlordId, 240) === landlordId)
    .map((record: any) => ({
      id: asString(record?.id || record?.rentPaymentId || record?.paymentId || "", 240) || asString(record?.id, 240),
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

async function loadLeasePaymentIntents(leaseId: string, landlordId: string | null) {
  const snap = await db.collection("paymentIntents").where("leaseId", "==", leaseId).get().catch(() => null);
  return (snap?.docs || [])
    .map((doc: any) => ({ paymentIntentId: doc.id, ...((doc.data() as any) || {}) }))
    .filter((record: any) => !landlordId || asString(record?.landlordId, 240) === landlordId);
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

async function deriveLeaseDecisionReadModel(req: any, leaseId: string) {
  const access = await loadLeaseForDecisionAccess(req, leaseId);
  if (!access.ok) return access;
  const { lease, landlordId } = access;
  const [rentPayments, paymentIntents] = await Promise.all([
    loadLeaseRentPayments(leaseId, landlordId),
    loadLeasePaymentIntents(leaseId, landlordId),
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
        amountCents: normalizeLeaseRentAmountCents((lease as any)?.monthlyRent),
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
      propertyId: asString((lease as any).propertyId, 240) || null,
      unitId: asString((lease as any).unitId, 240) || null,
      tenantId: asString((lease as any).tenantId || (lease as any).primaryTenantId, 240) || null,
    },
    obligationRows,
  });
  const actions = await loadDecisionActionsForLease(leaseId);
  return {
    ok: true as const,
    lease,
    landlordId,
    decisions: applyDecisionActions(decisions, actions),
    actions,
    obligationRows,
    obligationSummary: summarizePaymentObligationLedger(obligationRows),
    delinquencySignals,
    delinquencySummary: summarizeDelinquencySignals(delinquencySignals),
  };
}

function fallbackDecisionFromBody(body: any, decisionId: string, lease: any): Decision | null {
  const raw = body?.decision || {};
  const decisionType = asString(raw.decisionType, 80) as Decision["decisionType"];
  const severity = asString(raw.severity, 40) as Decision["severity"];
  const reason = asString(raw.reason, 1000);
  if (!decisionType || !severity || !reason) return null;
  return {
    decisionId,
    leaseId: asString(raw.leaseId || lease.id, 240),
    paymentIntentId: asString(raw.paymentIntentId, 240) || null,
    rentPaymentId: asString(raw.rentPaymentId, 240) || null,
    propertyId: asString(raw.propertyId || lease.propertyId, 240) || null,
    unitId: asString(raw.unitId || lease.unitId, 240) || null,
    tenantId: asString(raw.tenantId || lease.tenantId || lease.primaryTenantId, 240) || null,
    decisionType,
    severity,
    status: "detected",
    reason,
    metadata: typeof raw.metadata === "object" && raw.metadata ? raw.metadata : { source: "decision_action_request" },
    createdAt: asString(raw.createdAt, 120) || new Date().toISOString(),
    updatedAt: asString(raw.updatedAt, 120) || new Date().toISOString(),
  };
}

router.get("/", requireAuth, async (req: any, res: Response) => {
  try {
    const leaseId = asString(req.query?.leaseId, 240);
    if (!leaseId) return res.status(400).json({ ok: false, error: "decision_lease_id_required" });
    const model = await deriveLeaseDecisionReadModel(req, leaseId);
    if (!model.ok) return res.status(model.status).json({ ok: false, error: model.error });
    logDecisionStateMarkers(model.actions as Array<Record<string, unknown>>);
    return res.json({
      ok: true,
      decisions: model.decisions,
      actions: model.actions,
      summary: {
        total: model.decisions.filter((decision) => isActiveDecisionStatus(decision.status)).length,
        allTotal: model.decisions.length,
        inactiveTotal: model.decisions.filter((decision) => !isActiveDecisionStatus(decision.status)).length,
        critical: model.decisions.filter((decision) => isActiveDecisionStatus(decision.status) && decision.severity === "critical").length,
        warning: model.decisions.filter((decision) => isActiveDecisionStatus(decision.status) && decision.severity === "warning").length,
        info: model.decisions.filter((decision) => isActiveDecisionStatus(decision.status) && decision.severity === "info").length,
      },
    });
  } catch (err: any) {
    console.error("[decisionRoutes] GET /api/decisions failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "decision_list_failed" });
  }
});

router.post("/validate-transition", requireAuth, async (req: any, res: Response) => {
  try {
    const leaseId = asString(req.body?.leaseId, 240);
    const decisionId = asString(req.body?.decisionId, 600);
    if (!leaseId || !decisionId) return res.status(400).json({ ok: false, error: "decision_validation_invalid" });
    const model = await deriveLeaseDecisionReadModel(req, leaseId);
    if (!model.ok) return res.status(model.status).json({ ok: false, error: model.error });
    const action = model.actions.find((candidate: any) => asString(candidate?.decisionId, 600) === decisionId) || null;
    const validation = validateDecisionTransition((action || {}) as Record<string, unknown>, {
      to: String(req.body?.proposedTransition || req.body?.to || "") as DecisionActionState,
      event: String(req.body?.event || "") as DecisionEvent,
      captureEvidence: req.body?.captureEvidence === true,
      context: {
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId: actorIdFromReq(req),
        authorized: true,
        decisionId,
        landlordId: model.landlordId,
        actionRecordExists: Boolean(action),
        sourceValid: model.decisions.some((decision) => decision.decisionId === decisionId),
        snoozedUntil: asString(req.body?.snoozedUntil, 120) || null,
      },
    });
    if (validation.provenanceEvent) {
      try {
        await appendProvenanceEvent(validation.provenanceEvent, {
          authority: { actorRole: isAdmin(req) ? "admin" : "landlord", landlordRef: model.landlordId },
        });
        await appendReviewStateTransitionAuditEvent({
          provenanceEvent: validation.provenanceEvent,
          authority: { actorRole: isAdmin(req) ? "admin" : "landlord", landlordRef: model.landlordId },
        });
        res.setHeader("X-Provenance-Captured", "true");
      } catch (error) {
        console.warn("[provenance] decision capture skipped", { message: error instanceof Error ? error.message : "failed" });
      }
    }
    return res.status(200).json(buildValidationSummary(validation));
  } catch (err: any) {
    console.error("[state-machine] decision validation failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "decision_transition_validation_failed" });
  }
});

router.patch("/:decisionId/action", requireAuth, async (req: any, res: Response) => {
  try {
    const decisionId = decodeURIComponent(asString(req.params?.decisionId, 600));
    const leaseId = asString(req.body?.leaseId || req.body?.decision?.leaseId, 240);
    const patch = parseDecisionActionPatch(req.body);
    if (!decisionId || !leaseId || !patch) {
      return res.status(400).json({ ok: false, error: "decision_action_invalid" });
    }

    const model = await deriveLeaseDecisionReadModel(req, leaseId);
    if (!model.ok) return res.status(model.status).json({ ok: false, error: model.error });
    const existingActions = model.actions;
    const decision =
      model.decisions.find((candidate) => candidate.decisionId === decisionId) ||
      fallbackDecisionFromBody(req.body, decisionId, model.lease);
    if (!decision) return res.status(404).json({ ok: false, error: "decision_not_found" });

    const action = buildDecisionAction({
      decision,
      patch,
      existingActions,
      landlordId: model.landlordId,
      actorId: actorIdFromReq(req),
      actorEmail: actorEmailFromReq(req),
    });
    await db.collection(DECISION_ACTIONS_COLLECTION).doc(decisionActionRecordId(action)).set(action, { merge: false });
    const merged = applyDecisionActions([decision], [...existingActions, action])[0];

    return res.json({ ok: true, action, decision: merged });
  } catch (err: any) {
    console.error("[decisionRoutes] PATCH /api/decisions/:decisionId/action failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "decision_action_failed" });
  }
});

export default router;
