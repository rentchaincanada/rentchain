import type { CanonicalEventV1 } from "../events/eventTypes";
import type {
  LandlordAgentDecision,
  LandlordDecisionBlockedReason,
  LandlordDecisionExecutionOutcomeStatus,
  LandlordDecisionExecutionState,
  LandlordDecisionExecutionSummary,
} from "./analyticsTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toIsoOrNull(value: unknown) {
  const raw = asString(value, 240);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toMillis(value: unknown) {
  const iso = toIsoOrNull(value);
  return iso ? Date.parse(iso) : null;
}

function compareTimes(a: string | null, b: string | null) {
  const aMs = toMillis(a);
  const bMs = toMillis(b);
  if (aMs == null) return false;
  if (bMs == null) return true;
  return aMs > bMs;
}

function isDecisionEvent(event: CanonicalEventV1, decisionId: string) {
  if (asString(event.resource?.type, 120) !== "analytics_decision") return false;
  if (asString(event.resource?.id, 240) !== decisionId) return false;
  return asString(event.metadata?.decisionId, 240) === decisionId;
}

function deriveExecutionGuardKey(decision: LandlordAgentDecision) {
  if (decision.executionMappingState !== "mapped" || !decision.executionMapping) return null;
  return `${decision.executionMapping.action}:${decision.executionMapping.resourceType}:${decision.executionMapping.resourceId}`;
}

function deriveBlockedReason(decision: LandlordAgentDecision): LandlordDecisionBlockedReason {
  if (decision.state === "reviewed" || decision.state === "snoozed" || decision.state === "dismissed") {
    return "automation_disabled";
  }
  if (decision.automationState === "manual_only") {
    return "automation_disabled";
  }
  if (
    decision.executionInputMissingFields.includes("autoApprovalThreshold") ||
    (decision.executionInput &&
      "policyOutcome" in decision.executionInput &&
      decision.executionInput.policyOutcome != null &&
      decision.executionInput.policyOutcome !== "allow")
  ) {
    return "policy_blocked";
  }
  if (decision.executionMappingState !== "mapped") {
    return "missing_required_inputs";
  }
  if (decision.executionInputState !== "complete") {
    return "missing_required_inputs";
  }
  if (decision.automationState === "blocked") {
    return "unknown_state_fail_closed";
  }
  return "unknown_state_fail_closed";
}

function deriveExecutionSummary(decision: LandlordAgentDecision, canonicalEvents: CanonicalEventV1[]): LandlordDecisionExecutionSummary {
  let executionCount = 0;
  let lastExecutedAt: string | null = toIsoOrNull(decision.executedAt);
  let lastExecutionOutcome: LandlordDecisionExecutionOutcomeStatus = decision.executionOutcomeStatus || "none";
  let lastExecutionOutcomeAt: string | null = toIsoOrNull(decision.executionOutcomeAt);

  for (const event of canonicalEvents) {
    if (!isDecisionEvent(event, decision.id)) continue;
    const occurredAt = toIsoOrNull(event.occurredAt || event.recordedAt);
    if (event.type === "decision.executed") {
      executionCount += 1;
      if (compareTimes(occurredAt, lastExecutedAt)) {
        lastExecutedAt = occurredAt;
      }
      if (compareTimes(occurredAt, lastExecutionOutcomeAt)) {
        lastExecutionOutcome = "succeeded";
        lastExecutionOutcomeAt = occurredAt;
      }
    } else if (event.type === "decision.execution_failed") {
      executionCount += 1;
      if (compareTimes(occurredAt, lastExecutionOutcomeAt)) {
        lastExecutionOutcome = "failed";
        lastExecutionOutcomeAt = occurredAt;
      }
    }
  }

  if (executionCount === 0 && lastExecutionOutcome !== "none") {
    executionCount = 1;
  }

  return {
    lastExecutedAt,
    executionCount,
    lastExecutionOutcome,
    lastExecutionOutcomeAt,
  };
}

export function deriveDecisionExecutionState(
  decision: LandlordAgentDecision,
  canonicalEvents: CanonicalEventV1[]
): Pick<
  LandlordAgentDecision,
  "executionState" | "blockedReason" | "executionGuardKey" | "duplicateGuardActive" | "executionSummary"
> {
  const executionSummary = deriveExecutionSummary(decision, canonicalEvents);
  const executionGuardKey = deriveExecutionGuardKey(decision);
  const duplicateGuardActive =
    decision.state !== "executed" &&
    executionSummary.lastExecutionOutcome === "succeeded" &&
    executionSummary.executionCount > 0;

  let executionState: LandlordDecisionExecutionState;
  let blockedReason: LandlordDecisionBlockedReason | null = null;

  if (decision.state === "executed") {
    executionState = "already_executed";
  } else if (duplicateGuardActive) {
    executionState = "unsafe_duplicate";
    blockedReason = "duplicate_prevented";
  } else if (
    decision.automationState === "ready" &&
    decision.executionMappingState === "mapped" &&
    decision.executionInputState === "complete"
  ) {
    executionState = "executable";
  } else {
    executionState = "blocked";
    blockedReason = deriveBlockedReason(decision);
  }

  return {
    executionState,
    blockedReason,
    executionGuardKey,
    duplicateGuardActive,
    executionSummary,
  };
}

export function applyDecisionExecutionState(params: {
  decisions: LandlordAgentDecision[];
  canonicalEvents: CanonicalEventV1[];
}) {
  return params.decisions.map((decision) => ({
    ...decision,
    ...deriveDecisionExecutionState(decision, params.canonicalEvents),
  }));
}
