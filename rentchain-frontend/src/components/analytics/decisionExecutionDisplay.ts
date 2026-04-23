import type {
  LandlordAgentDecision,
  LandlordDecisionBlockedReason,
  LandlordDecisionExecutionState,
  LandlordDecisionExecutionSummary,
} from "@/api/landlordAnalyticsApi";
import { deriveDecisionExecutionState } from "./decisionExecutionAggregation";

type BadgeTone = {
  bg: string;
  text: string;
  border: string;
};

export type ExecutionStateDisplay = {
  label: string;
  title: string;
  description: string;
  badgeTone: BadgeTone;
};

export type BlockedReasonDisplay = {
  title: string;
  description: string;
};

export type AutomationPreview = {
  heading: string;
  status: string;
  summary: string;
  safeguardLabel: string;
  safeguardDescription: string;
  nextStep: string;
  duplicateProtectionActive: boolean;
  guardKeyLabel: string | null;
};

export const executionStateDisplay: Record<LandlordDecisionExecutionState, ExecutionStateDisplay> = {
  executable: {
    label: "Ready to run",
    title: "This decision is ready to run.",
    description: "All required execution inputs are present and the action can be started now.",
    badgeTone: {
      bg: "rgba(21, 128, 61, 0.1)",
      text: "#166534",
      border: "rgba(21, 128, 61, 0.18)",
    },
  },
  blocked: {
    label: "Action required",
    title: "This decision is blocked.",
    description: "Execution is currently unavailable until the blocking issue below is resolved.",
    badgeTone: {
      bg: "rgba(217, 119, 6, 0.12)",
      text: "#92400e",
      border: "rgba(217, 119, 6, 0.22)",
    },
  },
  already_executed: {
    label: "Completed",
    title: "This decision has already been completed.",
    description: "A successful execution was already recorded for this decision.",
    badgeTone: {
      bg: "rgba(21, 128, 61, 0.1)",
      text: "#166534",
      border: "rgba(21, 128, 61, 0.18)",
    },
  },
  unsafe_duplicate: {
    label: "Already processed",
    title: "This decision is protected from a duplicate run.",
    description: "A prior successful execution was detected, so this action is being held to avoid a duplicate run.",
    badgeTone: {
      bg: "rgba(185, 28, 28, 0.1)",
      text: "#991b1b",
      border: "rgba(185, 28, 28, 0.18)",
    },
  },
};

export const blockedReasonDisplay: Record<LandlordDecisionBlockedReason, BlockedReasonDisplay> = {
  missing_required_inputs: {
    title: "Missing required inputs",
    description: "This action still needs required execution inputs before it can run.",
  },
  policy_blocked: {
    title: "Blocked by policy checks",
    description: "A policy or safety rule is preventing this action from running right now.",
  },
  automation_disabled: {
    title: "Execution disabled for this state",
    description: "This decision is in a lifecycle state that does not allow execution.",
  },
  duplicate_prevented: {
    title: "Duplicate execution prevented",
    description: "A successful prior run was detected, so another execution is being blocked.",
  },
  unknown_state_fail_closed: {
    title: "Blocked until state is clear",
    description: "Execution is being held because the current decision state is ambiguous.",
  },
};

function formatWhen(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

export function formatExecutionSummary(summary?: LandlordDecisionExecutionSummary | null) {
  if (!summary || !summary.executionCount) return [];

  const countLabel = summary.executionCount === 1 ? "Executed 1 time" : `Executed ${summary.executionCount} times`;
  const outcomeLabel =
    summary.lastExecutionOutcome === "succeeded"
      ? "Last result: Succeeded"
      : summary.lastExecutionOutcome === "failed"
        ? "Last result: Failed"
        : null;
  const lastRun = formatWhen(summary.lastExecutedAt);
  const lastRunLabel = lastRun ? `Last run: ${lastRun}` : null;

  return [countLabel, outcomeLabel, lastRunLabel].filter(Boolean) as string[];
}

function suggestedAction(decision: LandlordAgentDecision) {
  return decision.actionLabel || decision.recommendedAction || "Review this decision";
}

function failClosedPreview(decision: LandlordAgentDecision): AutomationPreview {
  return {
    heading: "Automation preview",
    status: "Automation preview unavailable",
    summary: `${suggestedAction(decision)} is not available for preview from the current decision state.`,
    safeguardLabel: "Human confirmation required",
    safeguardDescription: "Manual review is required because the current automation state is incomplete or ambiguous.",
    nextStep: "Manual review required before any execution can be considered.",
    duplicateProtectionActive: Boolean(decision.duplicateGuardActive),
    guardKeyLabel: decision.executionGuardKey ? `Guard key: ${decision.executionGuardKey}` : null,
  };
}

export function deriveAutomationPreview(decision: LandlordAgentDecision): AutomationPreview {
  const executionState = deriveDecisionExecutionState(decision);
  const blockedReason = decision.blockedReason ? blockedReasonDisplay[decision.blockedReason] : null;
  const action = suggestedAction(decision);
  const guardKeyLabel = decision.executionGuardKey ? `Guard key: ${decision.executionGuardKey}` : null;

  if (!decision.actionLabel && !decision.recommendedAction) {
    return failClosedPreview(decision);
  }

  if (executionState === "unsafe_duplicate") {
    return {
      heading: "Automation preview",
      status: "Duplicate protection active",
      summary: `${action} is protected from repeat execution.`,
      safeguardLabel: "Duplicate safeguard active",
      safeguardDescription:
        "A prior successful run or matching guard key was detected, so another execution preview is held fail-closed.",
      nextStep: "Human confirmation is still required, but no repeat execution is available right now.",
      duplicateProtectionActive: true,
      guardKeyLabel,
    };
  }

  if (executionState === "already_executed") {
    return {
      heading: "Automation preview",
      status: "Completed preview",
      summary: `${action} has already been completed for this decision.`,
      safeguardLabel: "Human confirmation required",
      safeguardDescription: "This preview is historical only. No new execution is available from this completed state.",
      nextStep: "Review the recorded outcome if follow-up is needed.",
      duplicateProtectionActive: Boolean(decision.duplicateGuardActive),
      guardKeyLabel,
    };
  }

  if (executionState === "executable" && decision.automationEligible) {
    return {
      heading: "Automation preview",
      status: "Eligible for human-confirmed execution",
      summary: `${action} would be the next controlled step if a human operator chooses to run it.`,
      safeguardLabel: "Human confirmation required",
      safeguardDescription:
        "Execution remains manual. Existing mapping, readiness, and duplicate safeguards stay in place until a human confirms the action.",
      nextStep: "Review the decision, then use the existing execute control if you want to continue.",
      duplicateProtectionActive: Boolean(decision.duplicateGuardActive),
      guardKeyLabel,
    };
  }

  if (executionState === "blocked") {
    const reasonDescription = blockedReason?.description || decision.automationReason;
    const manualOnly = decision.automationState === "manual_only";
    return {
      heading: "Automation preview",
      status: decision.automationEligible ? "Blocked until requirements are complete" : "Automation preview unavailable",
      summary: reasonDescription
        ? `${action} is not currently available. ${reasonDescription}`
        : `${action} is not currently available from the current decision state.`,
      safeguardLabel: "Human confirmation required",
      safeguardDescription:
        "This decision stays fail-closed until the blocking requirement is resolved and a human reviews it again.",
      nextStep: manualOnly
        ? "Manual review required before any execution can be considered."
        : "Open the existing review flow to resolve the blocking requirement before execution is considered.",
      duplicateProtectionActive: Boolean(decision.duplicateGuardActive),
      guardKeyLabel,
    };
  }

  return failClosedPreview(decision);
}
