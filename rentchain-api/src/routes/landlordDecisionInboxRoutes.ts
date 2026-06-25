import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { deriveDecisionInbox } from "../lib/decisions/deriveDecisionInbox";
import type { LandlordAgentDecision } from "../lib/analytics/analyticsTypes";
import type { DecisionInboxItem, DecisionInboxResult } from "../lib/decisions/decisionInboxTypes";
import { deriveAutomatedWorkflowTransitions } from "../lib/automatedWorkflows/deriveAutomatedWorkflowTransitions";
import { derivePolicyGatedAgentActions } from "../lib/agentActions/derivePolicyGatedAgentActions";
import { deriveAgentSupervisionSnapshot } from "../lib/agentSupervision/deriveAgentSupervisionSnapshot";
import { deriveDecisions, type Decision } from "../lib/decisions/decisionEngine";
import { applyDecisionActions, DECISION_ACTIONS_COLLECTION } from "../lib/decisions/decisionActions";
import { deriveLeaseLifecycleState } from "../lib/leases/leaseLifecycle";
import { buildPaymentObligationLedgerRows, summarizePaymentObligationLedger } from "../lib/payments/paymentObligationLedger";
import { loadLeaseCanonicalPaymentEvidenceForObligationLedger } from "../lib/payments/leasePaymentObligationEvidence";
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

async function loadLeaseForLandlord(leaseId: string, landlordId: string) {
  const snap = await db.collection("leases").doc(leaseId).get().catch(() => null);
  if (!snap?.exists) return null;
  const lease = { id: snap.id, ...((snap.data() as any) || {}) };
  return [lease?.landlordId, lease?.ownerId, lease?.userId].some((value) => asString(value, 240) === landlordId)
    ? lease
    : null;
}

async function buildLeaseObligationRowsForDecisionInbox(lease: any, landlordId: string) {
  const leaseId = asString(lease?.id, 240);
  if (!leaseId) return [];
  const [rentPayments, paymentIntents, canonicalPaymentEvidence] = await Promise.all([
    loadLeaseRentPayments(leaseId, landlordId),
    loadLeasePaymentIntents(leaseId, landlordId),
    loadLeaseCanonicalPaymentEvidenceForObligationLedger(leaseId, landlordId),
  ]);
  const reconciliationRecords = await loadLeaseReconciliationRecords({
    leaseId,
    paymentIntentIds: paymentIntents.map((record: any) => asString(record?.paymentIntentId, 240)).filter(Boolean),
    rentPaymentIds: rentPayments.map((record) => asString(record?.id, 240)).filter(Boolean),
  });
  const lifecycle = deriveLeaseLifecycleState({ id: leaseId, ...lease });
  return buildPaymentObligationLedgerRows({
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
    canonicalPayments: canonicalPaymentEvidence,
    reconciliationRecords,
  });
}

export async function deriveLeaseDecisionsForInbox(landlordId: string): Promise<Decision[]> {
  const leases = await loadLandlordLeases(landlordId);
  const nested = await Promise.all(
    leases.map(async (lease) => {
      const leaseId = asString(lease?.id, 240);
      if (!leaseId) return [];
      const [obligationRows, actions] = await Promise.all([
        buildLeaseObligationRowsForDecisionInbox(lease, landlordId),
        loadDecisionActionsForLease(leaseId),
      ]);
      const lifecycle = deriveLeaseLifecycleState({ id: leaseId, ...lease });
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

function leaseIdFromDecisionItem(item: DecisionInboxItem): string {
  const relatedLeaseId = item.relatedEntity?.kind === "lease" ? asString(item.relatedEntity.id, 240) : "";
  if (relatedLeaseId) return relatedLeaseId;
  const destination = asString(item.destination, 600);
  const match = destination.match(/\/leases\/([^/?#]+)\/ledger(?:[/?#]|$)/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isActivePaymentDecisionItem(item: DecisionInboxItem): boolean {
  if (item.status === "resolved" || item.status === "dismissed") return false;
  if (item.type !== "billing" && item.workflow?.queue !== "delinquency_review") return false;
  return Boolean(leaseIdFromDecisionItem(item));
}

async function isLeasePaymentObligationSettled(leaseId: string, landlordId: string): Promise<boolean> {
  const lease = await loadLeaseForLandlord(leaseId, landlordId);
  if (!lease) return false;
  const obligationRows = await buildLeaseObligationRowsForDecisionInbox(lease, landlordId);
  if (obligationRows.length === 0) return false;
  const summary = summarizePaymentObligationLedger(obligationRows);
  if (summary.outstandingAmountCents > 0) return false;
  return deriveDelinquencySignals(obligationRows).length === 0;
}

async function suppressSettledPaymentDecisionItems(landlordId: string, items: DecisionInboxItem[]) {
  const settledByLeaseId = new Map<string, boolean>();
  const result: DecisionInboxItem[] = [];
  for (const item of items) {
    if (!isActivePaymentDecisionItem(item)) {
      result.push(item);
      continue;
    }
    const leaseId = leaseIdFromDecisionItem(item);
    if (!settledByLeaseId.has(leaseId)) {
      settledByLeaseId.set(leaseId, await isLeasePaymentObligationSettled(leaseId, landlordId));
    }
    if (!settledByLeaseId.get(leaseId)) result.push(item);
  }
  return result;
}

function summarizeDecisionInboxItems(items: DecisionInboxItem[]) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === "critical").length,
    high: items.filter((item) => item.severity === "high").length,
    open: items.filter((item) => item.status === "open").length,
    blocked: items.filter((item) => item.status === "blocked").length,
  };
}

function summarizeDecisionWorkflowItems(items: DecisionInboxItem[]) {
  return {
    new: items.filter((item) => item.workflow?.workflowState === "new").length,
    underReview: items.filter((item) => item.workflow?.workflowState === "under_review").length,
    escalated: items.filter((item) => item.workflow?.workflowState === "escalated").length,
    critical: items.filter((item) => item.workflow?.escalationLevel === "critical").length,
  };
}

function summarizeDecisionAutomationItems(items: DecisionInboxItem[]) {
  return {
    total: items.filter((item) => item.automatedWorkflow).length,
    pending: items.filter((item) => item.automatedWorkflow?.status === "pending").length,
    derived: items.filter((item) => item.automatedWorkflow?.status === "derived").length,
    blocked: items.filter((item) => item.automatedWorkflow?.status === "blocked").length,
    completed: items.filter((item) => item.automatedWorkflow?.status === "completed").length,
    escalationFlagged: items.filter((item) =>
      (item.automatedWorkflow?.canonicalEvents || []).some((event) => event.eventType === "automated_workflow_escalation_flagged")
    ).length,
    reviewRequired: items.filter((item) => item.automatedWorkflow?.manualReviewRequired === true).length,
  };
}

function summarizeDecisionAgentActionItems(items: DecisionInboxItem[]) {
  const actions = items.flatMap((item) => item.agentActions || []);
  return {
    total: actions.length,
    suggested: actions.filter((action) => action.status === "suggested").length,
    blocked: actions.filter((action) => action.status === "blocked").length,
    unavailable: actions.filter((action) => action.status === "unavailable").length,
    acknowledged: actions.filter((action) => action.status === "acknowledged").length,
    reviewRequired: actions.filter((action) => action.manualReviewRequired === true).length,
    escalationSuggested: actions.filter((action) => action.actionType === "suggest_escalation").length,
  };
}

export async function derivePaymentConsistentDecisionInbox(input: {
  landlordId: string;
  analyticsDecisions?: LandlordAgentDecision[] | null;
  leaseDecisions?: Decision[] | null;
  filters?: Parameters<typeof deriveDecisionInbox>[0]["filters"];
}): Promise<DecisionInboxResult> {
  const inbox = deriveDecisionInbox({
    analyticsDecisions: input.analyticsDecisions || [],
    leaseDecisions: input.leaseDecisions || [],
    filters: input.filters,
  });
  const items = await suppressSettledPaymentDecisionItems(input.landlordId, inbox.items);
  return {
    ...inbox,
    items,
    summary: summarizeDecisionInboxItems(items),
    workflowSummary: summarizeDecisionWorkflowItems(items),
    automationSummary: summarizeDecisionAutomationItems(items),
    agentActionSummary: summarizeDecisionAgentActionItems(items),
  };
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

    const inbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
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

router.get("/automated-workflows/preview", requireAuth, requireLandlord, async (req: any, res) => {
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

    const inbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
      filters: {
        severity: req.query?.severity,
        status: req.query?.decisionStatus,
        type: req.query?.type,
        queue: req.query?.queue,
        workflowState: req.query?.workflowState,
        escalationLevel: req.query?.escalationLevel,
      },
    });
    const preview = deriveAutomatedWorkflowTransitions({
      decisions: inbox.items,
      filters: {
        workflowType: req.query?.workflowType,
        status: req.query?.status,
        queue: req.query?.queue,
        escalationLevel: req.query?.escalationLevel,
      },
    });

    return res.json({
      ok: true,
      workflows: preview.workflows,
      summary: preview.summary,
      manualReviewRequired: true,
      externalExecutionEnabled: false,
    });
  } catch (err: any) {
    console.error("[landlord-automated-workflows] preview failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "AUTOMATED_WORKFLOW_PREVIEW_FAILED" });
  }
});

router.get("/agent-actions/suggestions", requireAuth, requireLandlord, async (req: any, res) => {
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

    const inbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
      filters: {
        severity: req.query?.severity,
        status: req.query?.decisionStatus,
        type: req.query?.type,
        queue: req.query?.queue,
        workflowState: req.query?.workflowState,
        escalationLevel: req.query?.escalationLevel,
      },
    });
    const suggestions = derivePolicyGatedAgentActions({
      decisions: inbox.items,
      filters: {
        actionType: req.query?.actionType,
        status: req.query?.status,
        queue: req.query?.queue,
        escalationLevel: req.query?.escalationLevel,
      },
    });

    return res.json({
      ok: true,
      actions: suggestions.actions,
      summary: suggestions.summary,
      manualReviewRequired: true,
      externalExecutionEnabled: false,
      requiresHumanApproval: true,
    });
  } catch (err: any) {
    console.error("[landlord-agent-actions] suggestions failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "AGENT_ACTION_SUGGESTIONS_FAILED" });
  }
});

router.get("/agent-supervision/snapshot", requireAuth, requireLandlord, async (req: any, res) => {
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

    const inbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
      filters: {
        severity: req.query?.severity,
        status: req.query?.decisionStatus,
        type: req.query?.type,
        queue: req.query?.queue,
        workflowState: req.query?.workflowState,
        escalationLevel: req.query?.escalationLevel,
      },
    });
    const supervision = deriveAgentSupervisionSnapshot({ decisions: inbox.items });

    return res.json({
      ok: true,
      ...supervision,
    });
  } catch (err: any) {
    console.error("[landlord-agent-supervision] snapshot failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "AGENT_SUPERVISION_SNAPSHOT_FAILED" });
  }
});

export default router;
