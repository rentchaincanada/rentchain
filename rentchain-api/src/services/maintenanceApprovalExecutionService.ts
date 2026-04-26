import crypto from "crypto";
import { db } from "../config/firebase";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { executeAutomation } from "../lib/automation/automationExecutor";
import { normalizeCostReviewHistory, normalizeWorkOrderCost } from "../lib/maintenanceCost";
import { hasSupportingEvidenceForWorkOrder } from "../lib/maintenanceApprovalReadiness";
import { buildMaintenancePolicyRequest } from "../lib/policy/policyAdapters";
import { evaluatePolicy, toAutopilotPolicySummary, writePolicyEvaluatedEvent } from "../lib/policy/policyEvaluator";
import { MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS } from "../lib/policy/policyRules";

function nowMs() {
  return Date.now();
}

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000): string | null {
  const v = asString(value, max);
  return v || null;
}

function makeCostHistoryEntryId() {
  return `cost_${crypto.randomBytes(8).toString("hex")}`;
}

function buildCostHistoryEntry(input: {
  revisionNumber: number;
  submittedAt: number;
  submittedByRole: "contractor" | "landlord" | "admin";
  submittedById: string;
  actualCostCents: number;
  currency?: string | null;
  reviewStatus: "pending_review" | "approved" | "rejected" | "revision_requested";
  reviewedAt?: number | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  linkedExpenseId?: string | null;
}) {
  return {
    id: makeCostHistoryEntryId(),
    revisionNumber: Math.max(1, Math.round(input.revisionNumber || 1)),
    submittedAt: Math.round(input.submittedAt),
    submittedByRole: input.submittedByRole,
    submittedById: input.submittedById,
    actualCostCents: Math.round(input.actualCostCents),
    currency: asString(input.currency, 12) || "CAD",
    reviewStatus: input.reviewStatus,
    reviewedAt: typeof input.reviewedAt === "number" ? Math.round(input.reviewedAt) : null,
    reviewedBy: asOptionalString(input.reviewedBy, 120),
    reviewNote: asOptionalString(input.reviewNote, 1000),
    linkedExpenseId: asOptionalString(input.linkedExpenseId, 120),
  };
}

function getCurrentCostRevisionNumber(data: any) {
  const current = Number(data?.cost?.latestRevisionNumber || 0);
  const historyMax = normalizeCostReviewHistory(data?.costReviewHistory).reduce(
    (max, entry) => Math.max(max, Number(entry.revisionNumber || 0)),
    0
  );
  return Math.max(current, historyMax, 0);
}

async function writeWorkOrderUpdate(input: {
  workOrderId: string;
  actorRole: "landlord" | "admin";
  actorId: string;
  updateType: "invoice";
  message?: string;
  attachmentUrl?: string | null;
}) {
  const createdAtMs = nowMs();
  const ref = db.collection("workOrderUpdates").doc();
  await ref.set({
    id: ref.id,
    workOrderId: input.workOrderId,
    actorRole: input.actorRole,
    actorId: input.actorId,
    updateType: input.updateType,
    message: asString(input.message || "", 5000),
    attachmentUrl: asOptionalString(input.attachmentUrl, 2000),
    createdAtMs,
  });
}

export async function loadMaintenanceApprovalWorkOrderForLandlord(params: {
  landlordId: string;
  workOrderId: string;
}) {
  const landlordId = asString(params.landlordId, 240);
  const workOrderId = asString(params.workOrderId, 240);
  if (!landlordId || !workOrderId) return { ok: false as const, error: "NOT_FOUND" as const };

  const snap = await db.collection("workOrders").doc(workOrderId).get();
  if (!snap.exists) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const workOrder = { id: snap.id, ...(snap.data() || {}) };
  const ownerLandlordId = asString((workOrder as any)?.landlordId, 240);
  if (ownerLandlordId && ownerLandlordId !== landlordId) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, workOrder };
}

export async function executeMaintenanceApprovalAutomation(params: {
  workOrderId: string;
  workOrder: any;
  actorId: string | null;
  actorRole: "landlord" | "admin";
  landlordId: string | null;
  initiatedFrom: "work_order_review_cost" | "decision_execute";
  decisionId?: string | null;
}) {
  const workOrderId = asString(params.workOrderId, 240);
  const workOrder = params.workOrder || {};
  const actorId = asString(params.actorId, 240) || null;
  const actorRole = params.actorRole;
  const landlordId = asString(params.landlordId, 240) || null;
  const currentCost = normalizeWorkOrderCost((workOrder as any)?.cost);
  if (!currentCost?.actualCostCents) {
    const error = new Error("COST_NOT_SUBMITTED");
    (error as any).code = "COST_NOT_SUBMITTED";
    throw error;
  }
  const actualCostCents = currentCost.actualCostCents;

  const policyRequest = buildMaintenancePolicyRequest({
    action: "approve_cost",
    actorRole,
    actorUserId: actorId,
    workOrderId,
    workOrder,
    actualCostCents,
  });
  const policyResult = evaluatePolicy(policyRequest);
  const autopilotPolicy = toAutopilotPolicySummary(policyResult);
  await writePolicyEvaluatedEvent({
    request: policyRequest,
    result: policyResult,
    actorType: actorRole,
    metadata: {
      landlordId: asOptionalString((workOrder as any)?.landlordId, 120) || landlordId,
      maintenanceRequestId: asOptionalString((workOrder as any)?.maintenanceRequestId, 120),
      propertyId: asOptionalString((workOrder as any)?.propertyId, 120),
      unitId: asOptionalString((workOrder as any)?.unitId, 120),
      initiatedFrom: params.initiatedFrom,
      decisionId: asOptionalString(params.decisionId, 240),
    },
  });

  const executeDecision = async () => {
    const now = nowMs();
    const currentRevisionNumber = getCurrentCostRevisionNumber(workOrder);
    const history = normalizeCostReviewHistory((workOrder as any)?.costReviewHistory);
    const updatedHistory =
      history.length > 0
        ? history.map((entry) =>
            entry.revisionNumber === currentRevisionNumber
              ? {
                  ...entry,
                  reviewStatus: "approved" as const,
                  reviewedAt: now,
                  reviewedBy: actorId,
                  reviewNote: null,
                }
              : entry
          )
        : [
            buildCostHistoryEntry({
              revisionNumber: Math.max(1, currentRevisionNumber || 1),
              submittedAt: Number(currentCost.submittedAt || now),
              submittedByRole:
                currentCost.submittedByRole === "contractor" || currentCost.submittedByRole === "admin"
                  ? currentCost.submittedByRole
                  : "landlord",
              submittedById: asString(currentCost.submittedById, 120) || actorId || landlordId || "system",
              actualCostCents,
              currency: currentCost.currency || "CAD",
              reviewStatus: "approved",
              reviewedAt: now,
              reviewedBy: actorId,
              reviewNote: null,
            }),
          ];

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...currentCost,
          reviewStatus: "approved",
          reviewedBy: actorId,
          reviewedAt: now,
          reviewNote: null,
          revisionRequestedAt: null,
          revisionRequestedBy: null,
        },
        costReviewHistory: updatedHistory,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole,
      actorId: actorId || landlordId || "system",
      updateType: "invoice",
      message: "Cost submission approved.",
    });

    await writeCanonicalEvent({
      domain: "expense",
      action: "approved",
      status: "approved",
      actor: {
        type: actorRole,
        role: actorRole,
        id: actorId,
      },
      resource: {
        type: "work_order_cost",
        id: workOrderId,
        parentType: "work_order",
        parentId: workOrderId,
      },
      occurredAt: now,
      visibility: "internal",
      summary: "Maintenance cost approved for expense reconciliation",
      metadata: {
        maintenanceRequestId: asOptionalString((workOrder as any)?.maintenanceRequestId, 120),
        propertyId: asOptionalString((workOrder as any)?.propertyId, 120),
        unitId: asOptionalString((workOrder as any)?.unitId, 120),
        actualCostCents,
        currency: currentCost.currency || "CAD",
        initiatedFrom: params.initiatedFrom,
        decisionId: asOptionalString(params.decisionId, 240),
      },
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return {
      workOrderId: refreshed.id,
      workOrder: refreshed.data() || null,
    };
  };

  const automation = await executeAutomation<"maintenance.auto_approve_cost", { workOrderId: string; workOrder: any | null }>({
    action: "maintenance.auto_approve_cost",
    policyResult,
    actor: {
      type: actorRole,
      id: actorId,
      role: actorRole,
    },
    resource: {
      type: "work_order",
      id: workOrderId,
    },
    visibility: "internal",
    metadata: {
      domain: "maintenance",
      landlordId: asOptionalString((workOrder as any)?.landlordId, 120) || landlordId,
      maintenanceRequestId: asOptionalString((workOrder as any)?.maintenanceRequestId, 120),
      propertyId: asOptionalString((workOrder as any)?.propertyId, 120),
      unitId: asOptionalString((workOrder as any)?.unitId, 120),
      policyAction: "approve_cost",
      initiatedFrom: params.initiatedFrom,
      decisionId: asOptionalString(params.decisionId, 240),
    },
    context: {
      alreadyApproved: String(currentCost.reviewStatus || "").toLowerCase() === "approved",
      actualCostCents,
      thresholdCents: MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS,
      hasSupportingEvidence: hasSupportingEvidenceForWorkOrder(workOrder),
      execute: executeDecision,
    },
  });

  return {
    autopilotPolicy,
    automationResult: automation.automationResult,
    workOrderId: automation.data?.workOrderId || workOrderId,
    workOrder: automation.data?.workOrder || null,
  };
}
