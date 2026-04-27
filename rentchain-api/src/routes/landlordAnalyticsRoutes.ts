import { Router } from "express";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { executeAutomation } from "../lib/automation/automationExecutor";
import { buildLeaseNoticePolicyRequest, buildScreeningPolicyRequest } from "../lib/policy/policyAdapters";
import { evaluatePolicy, toAutopilotPolicySummary, writePolicyEvaluatedEvent } from "../lib/policy/policyEvaluator";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { getScreeningProviderHealth } from "../services/screening/providerHealth";
import { assertTransUnionConnectedForScreening } from "../services/integrations/transunion/transunionService";
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
import {
  executeScreeningCheckout,
  isTransUnionReferralMode,
  loadLatestScreeningOrderForApplication,
  loadScreeningApplicationForLandlord,
  shouldUseMockScreeningCheckoutOverride,
} from "../services/screeningCheckoutExecutionService";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { deriveLandlordInbox } from "../services/landlordInbox/deriveLandlordInbox";
import {
  saveExecutedLandlordDecisionState,
  saveFailedLandlordDecisionExecutionOutcome,
  saveDismissedLandlordDecisionState,
  saveReviewedLandlordDecisionState,
  saveSnoozedLandlordDecisionState,
} from "../services/landlord/landlordDecisionStates";
import { loadLandlordDecisionTimeline } from "../services/landlord/landlordDecisionHistory";
import {
  deriveScreeningCheckoutExecutionInputSnapshot,
  evaluateScreeningApplicationEligibility,
  resolveScreeningConsentPayload,
  validateScreeningConsentPayload,
} from "../lib/screeningCheckoutReadiness";
import { loadLandlordApplicationFunnel } from "../services/landlord/landlordApplicationFunnel";
import { loadLandlordTransUnionOnboardingAnalytics } from "../services/landlord/loadLandlordTransUnionOnboardingAnalytics";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

type ReminderTiming =
  | "due_now"
  | "due_soon"
  | "scheduled_later"
  | "overdue"
  | "blocked"
  | "not_applicable";

type ReminderPriority = "low" | "medium" | "high";

function resolveFrontendOriginInput(req: any) {
  return (
    req?.headers?.["x-frontend-origin"] ||
    req?.headers?.origin ||
    req?.headers?.referer ||
    null
  );
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

function resolveDecisionExecutionState(decision: any) {
  if (decision?.executionState) return asString(decision.executionState, 80);
  if (decision?.duplicateGuardActive) return "unsafe_duplicate";
  if (decision?.state === "executed" || decision?.executionOutcomeStatus === "succeeded") return "already_executed";
  if (
    decision?.automationState === "ready" &&
    decision?.executionMappingState === "mapped" &&
    decision?.executionInputState === "complete"
  ) {
    return "executable";
  }
  return "blocked";
}

function resolveDecisionBlockedReason(decision: any) {
  if (decision?.blockedReason) return asString(decision.blockedReason, 80) || null;
  if (decision?.duplicateGuardActive) return "duplicate_prevented";
  if (decision?.automationState === "manual_only") return "automation_disabled";
  if (decision?.executionInputState !== "complete" || decision?.executionMappingState !== "mapped") {
    return "missing_required_inputs";
  }
  if (decision?.automationState === "blocked") return "unknown_state_fail_closed";
  return null;
}

function deriveDecisionReminderMetadata(decision: any) {
  const executionState = resolveDecisionExecutionState(decision);
  const blockedReason = resolveDecisionBlockedReason(decision);
  const actionLabel = asString(decision?.actionLabel || decision?.recommendedAction, 240) || null;

  if (executionState === "already_executed" || decision?.state === "executed") {
    return {
      reminderTiming: "not_applicable" as ReminderTiming,
      reminderTimingLabel: "No action needed",
      reminderTimingDescription: "This decision has already been handled and does not need another reminder.",
      reminderPriority: "low" as ReminderPriority,
      reminderBlockedReason: null,
      reminderNextActionLabel: null,
    };
  }

  if (decision?.state === "snoozed") {
    return {
      reminderTiming: "scheduled_later" as ReminderTiming,
      reminderTimingLabel: "Scheduled for later",
      reminderTimingDescription: "This decision is intentionally snoozed for later follow-up.",
      reminderPriority: "low" as ReminderPriority,
      reminderBlockedReason: null,
      reminderNextActionLabel: actionLabel,
    };
  }

  if (executionState === "unsafe_duplicate" || executionState === "blocked") {
    return {
      reminderTiming: "blocked" as ReminderTiming,
      reminderTimingLabel: "Blocked",
      reminderTimingDescription:
        executionState === "unsafe_duplicate"
          ? "Another matching action already appears active, so this reminder is safely blocked."
          : "This decision cannot move forward until its required inputs are ready.",
      reminderPriority: decision?.priority === "high" ? "high" : "medium",
      reminderBlockedReason: blockedReason,
      reminderNextActionLabel: actionLabel,
    };
  }

  if (executionState === "executable" && decision?.state === "reviewed") {
    return {
      reminderTiming: "due_soon" as ReminderTiming,
      reminderTimingLabel: "Due soon",
      reminderTimingDescription: "This decision remains ready and can be revisited soon when you are ready to continue.",
      reminderPriority: decision?.priority === "high" ? "high" : "medium",
      reminderBlockedReason: null,
      reminderNextActionLabel: actionLabel,
    };
  }

  return {
    reminderTiming: "due_now" as ReminderTiming,
    reminderTimingLabel: "Due now",
    reminderTimingDescription: "This decision is ready for landlord review or action now.",
    reminderPriority: decision?.priority === "high" ? "high" : decision?.priority === "low" ? "low" : "medium",
    reminderBlockedReason: null,
    reminderNextActionLabel: actionLabel,
  };
}

function controlledAutomationAuditMetadata(params: {
  landlordId: string;
  decisionId: string;
  decision: any;
  outcome: "previewed" | "confirmed" | "executed" | "failed";
  failureReason?: string | null;
}) {
  const { landlordId, decisionId, decision, outcome, failureReason } = params;
  return {
    landlordId,
    decisionId,
    decisionType: asString(decision?.decisionType, 120) || null,
    actionKey: asString(decision?.actionKey, 120) || null,
    actionLabel: asString(decision?.actionLabel, 240) || null,
    workflowCategory: asString(decision?.workflowCategory, 120) || null,
    executionState: resolveDecisionExecutionState(decision),
    blockedReason: resolveDecisionBlockedReason(decision),
    automationEligible: Boolean(decision?.automationEligible),
    duplicateGuardActive: Boolean(decision?.duplicateGuardActive),
    executionGuardKey: asString(decision?.executionGuardKey, 240) || null,
    executionSummaryExecutionCount: Number(decision?.executionSummary?.executionCount || 0),
    executionSummaryLastOutcome: asString(decision?.executionSummary?.lastExecutionOutcome, 40) || null,
    executionSummaryLastExecutedAt: asString(decision?.executionSummary?.lastExecutedAt, 80) || null,
    outcome,
    failureReason: failureReason ? asString(failureReason, 240) : null,
    source: "landlord_controlled_automation",
  };
}

function canAuditControlledAutomation(decision: any) {
  return (
    resolveDecisionExecutionState(decision) === "executable" &&
    !decision?.duplicateGuardActive &&
    asString(decision?.actionKey, 120) &&
    asString(decision?.actionLabel || decision?.recommendedAction, 240) &&
    decision?.executionMappingState === "mapped" &&
    decision?.executionInputState === "complete"
  );
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

    const decisions = Array.isArray(snapshot?.decisions?.items)
      ? snapshot.decisions.items.map((decision: any) => ({
          ...decision,
          ...deriveDecisionReminderMetadata(decision),
        }))
      : [];

    return res.json({
      ok: true,
      ...snapshot,
      decisions: {
        ...(snapshot?.decisions || {}),
        items: decisions,
      },
    });
  } catch (err: any) {
    console.error("[landlord-analytics] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ANALYTICS_FETCH_FAILED" });
  }
});

router.get("/landlord/analytics/inbox", requireAuth, requireLandlord, async (req: any, res) => {
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

    const inbox = await deriveLandlordInbox({
      landlordId,
      propertyId: req.query?.propertyId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
    });

    return res.json({
      ok: true,
      data: inbox,
    });
  } catch (err: any) {
    console.error("[landlord_inbox] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_INBOX_FAILED" });
  }
});

router.get("/landlord/analytics/applications/funnel", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const data = await loadLandlordApplicationFunnel({
      landlordId,
      propertyId: req.query?.propertyId,
    });

    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error("[landlord-analytics] application funnel failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_APPLICATION_FUNNEL_FETCH_FAILED" });
  }
});

router.get("/landlord/analytics/transunion-onboarding", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const data = await loadLandlordTransUnionOnboardingAnalytics(landlordId);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error("[landlord-analytics] transunion onboarding failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_TRANSUNION_ONBOARDING_FETCH_FAILED" });
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

router.post("/landlord/analytics/decisions/:decisionId/controlled-automation-audit", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;
    const actorId = asString(req.user?.id || landlordId, 240) || landlordId;
    const actorRole = asString(req.user?.role, 80).toLowerCase() || "landlord";
    const auditEvent = asString(req.body?.event, 80).toLowerCase();

    if (auditEvent !== "previewed" && auditEvent !== "confirmed") {
      return res.status(400).json({ ok: false, error: "INVALID_CONTROLLED_AUTOMATION_EVENT" });
    }
    if (!canAuditControlledAutomation(decision)) {
      return res.status(409).json({ ok: false, error: "CONTROLLED_AUTOMATION_AUDIT_NOT_ALLOWED" });
    }

    const occurredAt = new Date().toISOString();
    await writeCanonicalEvent({
      type: `controlled_automation.${auditEvent}`,
      domain: "system",
      action: `controlled_automation_${auditEvent}`,
      actor: { type: "landlord", id: actorId, role: actorRole },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt,
      visibility: "landlord",
      summary:
        auditEvent === "previewed"
          ? `Controlled automation preview opened for ${decisionId}.`
          : `Controlled automation confirmed for ${decisionId}.`,
      metadata: controlledAutomationAuditMetadata({
        landlordId,
        decisionId,
        decision,
        outcome: auditEvent as "previewed" | "confirmed",
      }),
    });

    return res.json({ ok: true, event: auditEvent, decisionId, occurredAt });
  } catch (err: any) {
    console.error("[landlord-analytics] controlled automation audit failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONTROLLED_AUTOMATION_AUDIT_FAILED" });
  }
});

router.post("/landlord/analytics/decisions/:decisionId/execute", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const resolved = await resolveVisibleDecision(req, res);
    if (!resolved) return;
    const { landlordId, decisionId, decision } = resolved;
    const actorId = asString(req.user?.id || landlordId, 240) || null;
    const actorRole = asString(req.user?.role, 80).toLowerCase() || "landlord";

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
      } else if (
        decision.executionMapping.action === "screening.auto_start_checkout" &&
        decision.executionMapping.resourceType === "rental_application"
      ) {
        const applicationId = decision.executionMapping.resourceId;
        const applicationResult = await loadScreeningApplicationForLandlord({
          landlordId,
          applicationId,
        });
        if (!applicationResult.ok) {
          return res.status(applicationResult.error === "FORBIDDEN" ? 403 : 404).json({
            ok: false,
            error: applicationResult.error,
          });
        }
        const application = applicationResult.application as any;

        const latestOrder = await loadLatestScreeningOrderForApplication(applicationId);
        const executionInput = deriveScreeningCheckoutExecutionInputSnapshot({
          application,
          latestOrder,
          now: Date.now(),
        });
        if (executionInput.state !== "complete") {
          return res.status(409).json({
            ok: false,
            error: "DECISION_INPUTS_INCOMPLETE",
            missingFields: executionInput.missingFields || [],
            reason: executionInput.reason || null,
          });
        }

        const consent = resolveScreeningConsentPayload({}, application);
        const consentCheck = validateScreeningConsentPayload(consent);
        if (!consentCheck.ok) {
          return res.status(409).json({
            ok: false,
            error: "DECISION_INPUTS_INCOMPLETE",
            missingFields: decision.executionInputMissingFields || [],
            reason: consentCheck.error,
          });
        }

        const providerHealth = await getScreeningProviderHealth();
        const referralMode = isTransUnionReferralMode();
        const allowMockOverride = shouldUseMockScreeningCheckoutOverride({
          role: actorRole,
          seedKey: decision.executionMapping.resourceId,
        });
        const providerReady =
          referralMode ||
          allowMockOverride ||
          process.env.NODE_ENV !== "production" ||
          (providerHealth.configured && providerHealth.preflightOk);

        if (
          process.env.NODE_ENV === "production" &&
          !referralMode &&
          providerHealth.configured &&
          providerHealth.preflightOk &&
          !allowMockOverride
        ) {
          try {
            await assertTransUnionConnectedForScreening(
              asString(application?.landlordId, 240) || landlordId
            );
          } catch (error: any) {
            if (error?.statusCode === 409 && error?.code === "transunion_not_connected") {
              return res.status(409).json({
                ok: false,
                error: "TRANSUNION_NOT_CONNECTED",
              });
            }
            throw error;
          }
        }

        const eligibility = evaluateScreeningApplicationEligibility(application);
        const policyRequest = buildScreeningPolicyRequest({
          action: "start_checkout",
          actorRole,
          actorUserId: actorId,
          applicationId,
          eligibility,
          application,
          consentComplete: consentCheck.ok,
          providerReady,
        });
        const policyResult = evaluatePolicy(policyRequest);
        const autopilotPolicy = toAutopilotPolicySummary(policyResult);
        await writePolicyEvaluatedEvent({
          request: policyRequest,
          result: policyResult,
          actorType: actorRole === "admin" ? "admin" : "landlord",
          metadata: {
            landlordId,
            propertyId: asString(application?.propertyId, 240) || null,
            unitId: asString(application?.unitId, 240) || null,
            initiatedFrom: "decision_execute",
            decisionId,
          },
        });

        automation = await executeAutomation({
          action: "screening.auto_start_checkout",
          policyResult,
          actor: {
            type: actorRole === "admin" ? "admin" : "landlord",
            id: actorId,
            role: actorRole,
          },
          resource: {
            type: "rental_application",
            id: applicationId,
          },
          visibility: "internal",
          metadata: {
            domain: "screening",
            initiatedFrom: "decision_execute",
            landlordId,
            propertyId: application?.propertyId || null,
            unitId: application?.unitId || null,
            decisionId,
            policyAction: "start_checkout",
          },
          context: {
            quoteExists: executionInput.input.quoteStatus === "generated",
            existingCheckout: executionInput.input.blockingReason === "SCREENING_CHECKOUT_ALREADY_EXISTS",
            alreadyPaid:
              executionInput.input.blockingReason === "SCREENING_ALREADY_PAID" ||
              executionInput.input.paymentStatus === "paid",
            execute: async () => {
              const execution = await executeScreeningCheckout({
                role: actorRole,
                actorId,
                landlordId,
                applicationId,
                application,
                body: req.body || {},
                consent,
                providerHealth,
                autopilotPolicy,
                frontendOrigin: resolveFrontendOriginInput(req),
                logBase: {
                  route: "landlord_analytics_decision_execute",
                  decisionId,
                  applicationId,
                },
              });
              if (execution.status !== 200) {
                const executionPayload = execution.payload as any;
                const error = new Error(String(executionPayload?.error || "AUTOMATION_EXECUTION_FAILED"));
                (error as any).code =
                  executionPayload?.errorCode || executionPayload?.error || "AUTOMATION_EXECUTION_FAILED";
                throw error;
              }
              return execution.payload;
            },
          },
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
      await writeCanonicalEvent({
        type: "controlled_automation.failed",
        domain: "system",
        action: "controlled_automation_failed",
        status: "failed",
        actor: { type: "landlord", id: actorId, role: actorRole },
        resource: { type: "analytics_decision", id: decisionId },
        occurredAt: persistedFailureState.executionOutcomeAt || persistedFailureState.updatedAt,
        visibility: "landlord",
        summary: `Controlled automation failed for ${decisionId}.`,
        metadata: controlledAutomationAuditMetadata({
          landlordId,
          decisionId,
          decision,
          outcome: "failed",
          failureReason: persistedFailureState.executionOutcomeReason || null,
        }),
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
    await writeCanonicalEvent({
      type: success ? "controlled_automation.executed" : "controlled_automation.failed",
      domain: "system",
      action: success ? "controlled_automation_executed" : "controlled_automation_failed",
      status: success ? "executed" : "failed",
      actor: { type: "landlord", id: actorId, role: actorRole },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: automation.automationResult.timestamp,
      visibility: "landlord",
      summary: success
        ? `Controlled automation executed for ${decisionId}.`
        : `Controlled automation failed for ${decisionId}.`,
      metadata: controlledAutomationAuditMetadata({
        landlordId,
        decisionId,
        decision,
        outcome: success ? "executed" : "failed",
        failureReason: automation.automationResult.reason || null,
      }),
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
