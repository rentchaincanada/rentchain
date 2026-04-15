import { writeCanonicalEvent } from "../events/buildEvent";
import { getPolicyRules } from "./policyRules";
import type {
  AutopilotPolicySummary,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  PolicyRule,
} from "./policyTypes";

function compareRules(a: PolicyRule, b: PolicyRule) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.id.localeCompare(b.id);
}

export function evaluatePolicy(request: PolicyEvaluationRequest): PolicyEvaluationResult {
  const rules = getPolicyRules(request.domain, request.action).sort(compareRules);
  const matched = rules.filter((rule) => {
    try {
      return rule.matches(request);
    } catch {
      return false;
    }
  });
  const selected = matched[0];
  const evaluatedAt = new Date().toISOString();

  if (!selected) {
    return {
      version: "v1",
      domain: request.domain,
      action: request.action,
      outcome: "defer",
      reasons: [
        {
          code: "POLICY_RULE_NOT_FOUND",
          message: "No policy rule matched this request.",
          severity: "warning",
        },
      ],
      matchedRules: [],
      requiresManualApproval: false,
      canAutopilot: false,
      evaluatedAt,
    };
  }

  return {
    version: "v1",
    domain: request.domain,
    action: request.action,
    outcome: selected.outcome,
    reasons: matched.map((rule) => ({
      code: rule.reasonCode,
      message: rule.reasonMessage,
      severity: rule.severity,
    })),
    matchedRules: matched.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.ruleName,
    })),
    requiresManualApproval: selected.outcome === "review",
    canAutopilot: selected.outcome === "allow",
    evaluatedAt,
  };
}

export function toAutopilotPolicySummary(result: PolicyEvaluationResult): AutopilotPolicySummary {
  const topReason = result.reasons[0];
  return {
    outcome: result.outcome,
    canAutopilot: result.canAutopilot,
    requiresManualApproval: result.requiresManualApproval,
    topReasonCode: topReason?.code || null,
    topReasonMessage: topReason?.message || null,
    evaluatedAt: result.evaluatedAt,
  };
}

export async function writePolicyEvaluatedEvent(input: {
  request: PolicyEvaluationRequest;
  result: PolicyEvaluationResult;
  actorType?: "user" | "system" | "admin" | "tenant" | "landlord" | "contractor" | "service";
  visibility?: "internal" | "landlord" | "tenant" | "admin" | "system";
  metadata?: Record<string, unknown>;
}) {
  const topReason = input.result.reasons[0];
  await writeCanonicalEvent({
    domain: "policy",
    type: "policy.evaluated",
    action: "evaluated",
    status: input.result.outcome,
    actor: {
      type: input.actorType,
      id: input.request.actor.userId || null,
      role: input.request.actor.role || null,
    },
    resource: {
      type: input.request.resource.type || "policy_resource",
      id: input.request.resource.id || "unknown",
    },
    occurredAt: input.result.evaluatedAt,
    visibility: input.visibility || "internal",
    summary: `Policy evaluated for ${input.request.domain}.${input.request.action}`,
    metadata: {
      domain: input.request.domain,
      action: input.request.action,
      outcome: input.result.outcome,
      resourceType: input.request.resource.type || null,
      resourceId: input.request.resource.id || null,
      topReasonCode: topReason?.code || null,
      topReasonMessage: topReason?.message || null,
      matchedRules: input.result.matchedRules,
      ...input.metadata,
    },
  });
}
