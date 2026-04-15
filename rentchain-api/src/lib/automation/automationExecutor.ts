import { writeCanonicalEvent } from "../events/buildEvent";
import { runAutomationAction } from "./automationActions";
import type {
  AutomationAction,
  AutomationActionContextMap,
  AutomationExecutionResult,
  AutomationExecutorInput,
} from "./automationTypes";

function policySkipReason(action: AutomationAction, policyOutcome: string, requiresManualApproval: boolean) {
  if (policyOutcome === "block") return `${action.toUpperCase().replace(/[.]/g, "_")}_POLICY_BLOCKED`;
  if (policyOutcome === "review" || requiresManualApproval) {
    return `${action.toUpperCase().replace(/[.]/g, "_")}_POLICY_REVIEW_REQUIRED`;
  }
  if (policyOutcome !== "allow") return `${action.toUpperCase().replace(/[.]/g, "_")}_POLICY_DEFERRED`;
  return `${action.toUpperCase().replace(/[.]/g, "_")}_POLICY_SKIPPED`;
}

async function writeAutomationEvent(input: {
  type: "automation.executed" | "automation.skipped";
  result: AutomationExecutionResult;
  policyOutcome: string;
  actor: {
    type?: "user" | "system" | "admin" | "tenant" | "landlord" | "contractor" | "service";
    id?: string | null;
    role?: string | null;
  };
  resource: {
    type: string;
    id: string;
    parentType?: string | null;
    parentId?: string | null;
  };
  visibility?: "internal" | "landlord" | "tenant" | "admin" | "system";
  metadata?: Record<string, unknown>;
}) {
  await writeCanonicalEvent({
    domain: "system",
    type: input.type,
    action: input.type === "automation.executed" ? "executed" : "skipped",
    status: input.result.executed ? "executed" : "skipped",
    actor: input.actor,
    resource: input.resource,
    occurredAt: input.result.timestamp,
    visibility: input.visibility || "internal",
    summary:
      input.type === "automation.executed"
        ? `Automation executed for ${input.result.action}`
        : `Automation skipped for ${input.result.action}`,
    metadata: {
      action: input.result.action,
      executed: input.result.executed,
      skipped: input.result.skipped,
      reason: input.result.reason || null,
      policyOutcome: input.policyOutcome,
      ...input.metadata,
    },
  });
}

export async function executeAutomation<A extends AutomationAction, T = unknown>(
  input: AutomationExecutorInput<A, T>
): Promise<{ automationResult: AutomationExecutionResult; data?: T }> {
  const timestamp = new Date().toISOString();

  if (input.policyResult.outcome !== "allow" || input.policyResult.requiresManualApproval) {
    const automationResult: AutomationExecutionResult = {
      action: input.action,
      executed: false,
      skipped: true,
      reason: policySkipReason(input.action, input.policyResult.outcome, input.policyResult.requiresManualApproval),
      timestamp,
    };
    await writeAutomationEvent({
      type: "automation.skipped",
      result: automationResult,
      policyOutcome: input.policyResult.outcome,
      actor: input.actor,
      resource: input.resource,
      visibility: input.visibility,
      metadata: input.metadata,
    });
    return { automationResult };
  }

  try {
    const actionResult = await runAutomationAction(
      input.action,
      input.context as AutomationActionContextMap<T>[A]
    );
    const automationResult: AutomationExecutionResult = {
      action: input.action,
      executed: actionResult.executed,
      skipped: actionResult.skipped,
      reason: actionResult.reason,
      timestamp,
    };
    await writeAutomationEvent({
      type: actionResult.executed ? "automation.executed" : "automation.skipped",
      result: automationResult,
      policyOutcome: input.policyResult.outcome,
      actor: input.actor,
      resource: input.resource,
      visibility: input.visibility,
      metadata: input.metadata,
    });
    return { automationResult, data: actionResult.data };
  } catch (err: any) {
    const automationResult: AutomationExecutionResult = {
      action: input.action,
      executed: false,
      skipped: true,
      reason: String(err?.code || err?.message || "AUTOMATION_EXECUTION_FAILED"),
      timestamp,
    };
    await writeAutomationEvent({
      type: "automation.skipped",
      result: automationResult,
      policyOutcome: input.policyResult.outcome,
      actor: input.actor,
      resource: input.resource,
      visibility: input.visibility,
      metadata: input.metadata,
    });
    return { automationResult };
  }
}
