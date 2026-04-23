import type {
  LandlordDecisionBlockedReason,
  LandlordDecisionExecutionState,
  LandlordDecisionExecutionSummary,
} from "@/api/landlordAnalyticsApi";

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
