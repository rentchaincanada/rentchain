import { Router } from "express";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { executeAutomation } from "../lib/automation/automationExecutor";
import { buildLeaseNoticePolicyRequest } from "../lib/policy/policyAdapters";
import { evaluatePolicy, toAutopilotPolicySummary, writePolicyEvaluatedEvent } from "../lib/policy/policyEvaluator";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  buildLeaseNoticePreviewInputFromLease,
  getLeaseForLandlordWorkflow,
  normalizeLeaseRecord,
  performLeaseNoticeSendFromPreviewInput,
} from "../services/leaseNoticeWorkflowService";
import {
  executeMaintenanceApprovalAutomation,
  loadMaintenanceApprovalWorkOrderForLandlord,
} from "../services/maintenanceApprovalExecutionService";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import {
  saveExecutedLandlordDecisionState,
  saveFailedLandlordDecisionExecutionOutcome,
  saveDismissedLandlordDecisionState,
  saveReviewedLandlordDecisionState,
  saveSnoozedLandlordDecisionState,
} from "../services/landlord/landlordDecisionStates";
import { loadLandlordDecisionTimeline } from "../services/landlord/landlordDecisionHistory";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function decisionStatePayload(state: any) {
  return {
    decisionId: state.decisionId,
    state: state.state,
    reviewedAt: state.reviewedAt || null,
    dismissedAt: state.dismissedAt || null,
    snoozedAt: state.snoozedAt || null,
    snoozedUntil: state.snoozedUntil || null,
    executedAt: state.executedAt || null,
    executionOutcomeStatus: state.executionOutcomeStatus || "none",
    executionOutcomeAt: state.executionOutcomeAt || null,
    executionOutcomeReason: state.executionOutcomeReason || null,
    updatedAt: state.updatedAt,
  };
}

async function resolveVisibleDecision(req: any, res: any) {
  const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
  if (!landlordId) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }

  const decisionId = asString(req.params?.decisionId, 240);
  if (!decisionId) {
    res.status(400).json({ ok: false, error: "DECISION_ID_REQUIRED" });
    return null;
  }

  const snapshot = await loadLandlordAnalyticsSnapshot({
    landlordId,
    period: req.query?.period,
    propertyId: req.query?.propertyId,
  });
  const decision = snapshot.decisions.items.find((item) => asString(item.id, 240) === decisionId) || null;
  if (!decision) {
    res.status(404).json({ ok: false, error: "DECISION_NOT_VISIBLE" });
    return null;
  }

  return { landlordId, decisionId, decision };
}

router.get("/landlord/analytics", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const snapshot = await loadLandlordAnalyticsSnapshot({
      landlordId,
      period: req.query?.period,
      propertyId: req.query?.propertyId,
    });

    return res.json({ ok: true, ...snapshot });
  } catch (err: any) {
    console.error("[landlord-analytics] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ANALYTICS_FETCH_FAILED" });
  }
});

router.get("/landlord/analytics/decisions/:decisionId/history", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId } = resolved;

    const events = await loadLandlordDecisionTimeline({
      landlordId,
      decisionId,
    });

    return res.json({
      ok: true,
      decisionId,
      events,
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision history failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_HISTORY_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/review", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

    const state = await saveReviewedLandlordDecisionState({
      landlordId,
      decisionId,
    });

    await writeCanonicalEvent({
      type: "decision.reviewed",
      domain: "system",
      action: "reviewed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.reviewedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} reviewed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        source: "landlord_analytics_decisions",
      },
    });

    return res.json({
      ok: true,
      state: {
        decisionId: state.decisionId,
        state: state.state,
        reviewedAt: state.reviewedAt || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision review failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_REVIEW_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/snooze", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

    const snoozedUntil = asString(req.body?.snoozedUntil, 80);
    if (!snoozedUntil) {
      return res.status(400).json({ ok: false, error: "SNOOZED_UNTIL_REQUIRED" });
    }

    const state = await saveSnoozedLandlordDecisionState({
      landlordId,
      decisionId,
      snoozedUntil,
    });

    await writeCanonicalEvent({
      type: "decision.snoozed",
      domain: "system",
      action: "snoozed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.snoozedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} snoozed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        snoozedUntil: state.snoozedUntil || null,
        source: "landlord_analytics_decisions",
      },
    });

    return res.json({
      ok: true,
      state: {
        decisionId: state.decisionId,
        state: state.state,
        snoozedAt: state.snoozedAt || null,
        snoozedUntil: state.snoozedUntil || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    const message = err?.message || "";
    if (message === "landlord_decision_state_invalid_snoozed_until" || message === "landlord_decision_state_snooze_must_be_future") {
      return res.status(400).json({ ok: false, error: "INVALID_SNOOZE_WINDOW" });
    }
    console.error("[landlord-analytics] decision snooze failed", message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_SNOOZE_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/dismiss", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;

    const state = await saveDismissedLandlordDecisionState({
      landlordId,
      decisionId,
    });

    await writeCanonicalEvent({
      type: "decision.dismissed",
      domain: "system",
      action: "dismissed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: state.dismissedAt || state.updatedAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} dismissed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        source: "landlord_analytics_decisions",
      },
    });

    return res.json({
      ok: true,
      state: {
        decisionId: state.decisionId,
        state: state.state,
        dismissedAt: state.dismissedAt || null,
        updatedAt: state.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision dismiss failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_DISMISS_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/execute", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;
    const actorId = asString(req.user?.id || landlordId, 240) || null;

    if (decision.automationState !== "ready") {
      return res.status(409).json({ ok: false, error: "DECISION_NOT_READY", reason: decision.automationReason || null });
    }
    if (decision.state === "executed") {
      return res.status(409).json({
        ok: false,
        error: "DECISION_ALREADY_EXECUTED",
        state: {
          decisionId,
          state: decision.state,
          executedAt: decision.executedAt || null,
          executionOutcomeStatus: decision.executionOutcomeStatus,
          executionOutcomeAt: decision.executionOutcomeAt || null,
          executionOutcomeReason: decision.executionOutcomeReason || null,
        },
      });
    }
    if (decision.executionMappingState !== "mapped" || !decision.executionMapping) {
      return res.status(409).json({ ok: false, error: "DECISION_NOT_MAPPED" });
    }
    if (decision.executionInputState !== "complete" || !decision.executionInput) {
      return res.status(409).json({
        ok: false,
        error: "DECISION_INPUTS_INCOMPLETE",
        missingFields: decision.executionInputMissingFields || [],
        reason: decision.executionInputReason || null,
      });
    }
    await writeCanonicalEvent({
      type: "decision.execution_requested",
      domain: "system",
      action: "execution_requested",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: new Date().toISOString(),
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} execution requested.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        action: decision.executionMapping.action,
        resourceType: decision.executionMapping.resourceType,
        resourceId: decision.executionMapping.resourceId,
        source: "landlord_analytics_decisions",
      },
    });

    let automation;
    try {
      if (decision.executionMapping.action === "lease.auto_send_notice" && decision.executionMapping.resourceType === "lease") {
        const leaseResult = await getLeaseForLandlordWorkflow(decision.executionMapping.resourceId, landlordId);
        if (!leaseResult.ok) {
          return res.status(leaseResult.status).json({ ok: false, error: leaseResult.error });
        }
        const lease = normalizeLeaseRecord(leaseResult.lease.id || decision.executionMapping.resourceId, leaseResult.lease);
        const previewInput = buildLeaseNoticePreviewInputFromLease(lease);
        if (!previewInput) {
          return res.status(409).json({
            ok: false,
            error: "DECISION_INPUTS_INCOMPLETE",
            missingFields: decision.executionInputMissingFields || [],
            reason: decision.executionInputReason || null,
          });
        }

        const requestBody = {
          rentChangeMode: previewInput.rentChangeMode,
          proposedRent: previewInput.proposedRent,
          newTermType: previewInput.newTermType,
          newLeaseStartDate: previewInput.newLeaseStartDate,
          newLeaseEndDate: previewInput.newLeaseEndDate,
          responseDeadlineAt: previewInput.responseDeadlineAt,
          noticeType: previewInput.noticeType,
        };
        const policyRequest = buildLeaseNoticePolicyRequest({
          action: "send_notice",
          actorRole: asString(req.user?.role, 80).toLowerCase() || "landlord",
          actorUserId: actorId,
          lease,
          leaseId: lease.id,
          requestBody,
        });
        const policyResult = evaluatePolicy(policyRequest);
        const autopilotPolicy = toAutopilotPolicySummary(policyResult);
        await writePolicyEvaluatedEvent({
          request: policyRequest,
          result: policyResult,
          actorType: "landlord",
          metadata: {
            landlordId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            initiatedFrom: "decision_execute",
            decisionId,
          },
        });

        automation = await executeAutomation({
          action: "lease.auto_send_notice",
          policyResult,
          actor: {
            type: "landlord",
            id: actorId,
            role: "landlord",
          },
          resource: {
            type: "lease",
            id: lease.id,
          },
          visibility: "internal",
          metadata: {
            domain: "lease_notice",
            initiatedFrom: "decision_execute",
            landlordId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            decisionId,
            policyAction: "send_notice",
          },
          context: {
            noticeReady: true,
            alreadySent: Boolean(lease.latestNoticeId),
            hasRequiredLegalInputs: Boolean(policyRequest.context.hasRequiredLegalInputs),
            execute: async () => {
              const execution = await performLeaseNoticeSendFromPreviewInput({
                leaseId: lease.id,
                landlordId,
                actorId,
                lease,
                previewInput,
                autopilotPolicy,
              });
              if (execution.status >= 400 || !execution.payload.ok) {
                const error = new Error(String(execution.payload?.error || "AUTOMATION_EXECUTION_FAILED"));
                (error as any).code = execution.payload?.error || "AUTOMATION_EXECUTION_FAILED";
                throw error;
              }
              return execution.payload;
            },
          },
        });
      } else if (
        decision.executionMapping.action === "maintenance.auto_approve_cost" &&
        decision.executionMapping.resourceType === "work_order"
      ) {
        const workOrderResult = await loadMaintenanceApprovalWorkOrderForLandlord({
          landlordId,
          workOrderId: decision.executionMapping.resourceId,
        });
        if (!workOrderResult.ok) {
          return res.status(workOrderResult.error === "FORBIDDEN" ? 403 : 404).json({
            ok: false,
            error: workOrderResult.error,
          });
        }

        automation = await executeMaintenanceApprovalAutomation({
          workOrderId: decision.executionMapping.resourceId,
          workOrder: workOrderResult.workOrder,
          actorId,
          actorRole: "landlord",
          landlordId,
          initiatedFrom: "decision_execute",
          decisionId,
        });
      } else {
        return res.status(409).json({ ok: false, error: "DECISION_EXECUTION_UNSUPPORTED" });
      }
    } catch (executionErr: any) {
      const persistedFailureState = await saveFailedLandlordDecisionExecutionOutcome({
        landlordId,
        decisionId,
        reason: executionErr?.code || executionErr?.message || "LANDLORD_DECISION_EXECUTE_FAILED",
      });
      await writeCanonicalEvent({
        type: "decision.execution_failed",
        domain: "system",
        action: "execution_failed",
        status: "failed",
        actor: { type: "landlord", id: landlordId, role: "landlord" },
        resource: { type: "analytics_decision", id: decisionId },
        occurredAt: persistedFailureState.executionOutcomeAt || persistedFailureState.updatedAt,
        visibility: "landlord",
        summary: `Analytics decision ${decisionId} execution failed.`,
        metadata: {
          landlordId,
          decisionId,
          decisionType: decision.decisionType,
          action: decision.executionMapping.action,
          resourceType: decision.executionMapping.resourceType,
          resourceId: decision.executionMapping.resourceId,
          reason: persistedFailureState.executionOutcomeReason || null,
          source: "landlord_analytics_decisions",
        },
      });
      return res.status(500).json({
        ok: false,
        error: "LANDLORD_DECISION_EXECUTE_FAILED",
        state: decisionStatePayload(persistedFailureState),
      });
    }

    const success = Boolean(automation.automationResult.executed);
    const persistedState = success
      ? await saveExecutedLandlordDecisionState({
          landlordId,
          decisionId,
        })
      : await saveFailedLandlordDecisionExecutionOutcome({
          landlordId,
          decisionId,
          reason: automation.automationResult.reason || "DECISION_EXECUTION_FAILED",
        });

    await writeCanonicalEvent({
      type: success ? "decision.executed" : "decision.execution_failed",
      domain: "system",
      action: success ? "executed" : "execution_failed",
      status: success ? "executed" : "failed",
      actor: { type: "landlord", id: landlordId, role: "landlord" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: automation.automationResult.timestamp,
      visibility: "landlord",
      summary: success
        ? `Analytics decision ${decisionId} executed.`
        : `Analytics decision ${decisionId} execution failed.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        action: decision.executionMapping.action,
        resourceType: decision.executionMapping.resourceType,
        resourceId: decision.executionMapping.resourceId,
        reason: automation.automationResult.reason || null,
        source: "landlord_analytics_decisions",
      },
    });

    if (!success) {
      return res.status(409).json({
        ok: false,
        error: "DECISION_EXECUTION_FAILED",
        automationResult: automation.automationResult,
        state: decisionStatePayload(persistedState),
      });
    }

    const executionPayload =
      "data" in automation && automation.data && typeof automation.data === "object" ? automation.data : {};

    return res.json({
      ok: true,
      execution: {
        decisionId,
        action: decision.executionMapping.action,
        resourceType: decision.executionMapping.resourceType,
        resourceId: decision.executionMapping.resourceId,
      },
      automationResult: automation.automationResult,
      state: decisionStatePayload(persistedState),
      ...executionPayload,
    });
  } catch (err: any) {
    console.error("[landlord-analytics] decision execute failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_EXECUTE_FAILED" });
  }
});

export default router;
