import type { TenantWorkspaceLease } from "../api/tenantPortal";
import type { LeaseExecutionReadinessView } from "./leaseExecutionReadinessState";

export type LeaseExecutionWorkspaceState =
  | "not_ready_for_execution"
  | "ready_for_execution"
  | "execution_in_progress"
  | "awaiting_execution_action";

export type LeaseExecutionWorkspaceView = {
  executionState: LeaseExecutionWorkspaceState;
  label: string;
  summary: string;
  explanation: string;
  blockers: string[];
  nextSteps: string[];
  timelineEvent: {
    title: string;
    description: string;
    actionRequired: boolean;
  } | null;
};

function hasLeaseProjection(lease: TenantWorkspaceLease | null | undefined): boolean {
  if (!lease) return false;
  return Boolean(String(lease.leaseId || "").trim() || String(lease.status || "").trim());
}

function hasLeaseDocument(lease: TenantWorkspaceLease | null | undefined): boolean {
  return Boolean(String(lease?.documentUrl || "").trim());
}

function stateLabel(state: LeaseExecutionWorkspaceState): string {
  if (state === "execution_in_progress") return "Execution in progress";
  if (state === "ready_for_execution") return "Ready for execution";
  if (state === "awaiting_execution_action") return "Awaiting execution action";
  return "Not ready for execution";
}

export function buildLeaseExecutionWorkspace(input: {
  audience: "landlord" | "tenant";
  executionReadiness: LeaseExecutionReadinessView;
  lease?: TenantWorkspaceLease | null;
}): LeaseExecutionWorkspaceView {
  const lease = input.lease || null;
  const leaseVisible = hasLeaseProjection(lease);
  const leaseDocumentVisible = hasLeaseDocument(lease);

  if (leaseVisible && leaseDocumentVisible) {
    return {
      executionState: "execution_in_progress",
      label: stateLabel("execution_in_progress"),
      summary: "Lease execution workspace",
      explanation:
        "A visible lease record and document are already present, so the execution handoff has started in the current authorized workspace.",
      blockers: [],
      nextSteps:
        input.audience === "landlord"
          ? [
              "Use the existing lease workflow for the current execution-related step.",
              "Keep this workspace as the high-level handoff reference for any remaining operational follow-through.",
            ]
          : [
              "Review the current lease details and follow the next tenant-visible instruction when it appears.",
              "Keep an eye on your tenant workspace for any remaining lease-related updates.",
            ],
      timelineEvent: {
        title: "Execution started",
        description:
          "A visible lease record and document indicate the current file has moved into execution handoff.",
        actionRequired: false,
      },
    };
  }

  if (
    input.executionReadiness.readinessState === "ready_for_execution" ||
    (input.audience === "landlord" &&
      input.executionReadiness.readinessState === "awaiting_next_action")
  ) {
    return {
      executionState: "ready_for_execution",
      label: stateLabel("ready_for_execution"),
      summary: "Lease execution workspace",
      explanation:
        input.executionReadiness.readinessState === "ready_for_execution"
          ? "The visible file appears ready to move into execution, and the next execution-related handoff can proceed when the supported workflow step begins."
          : "The visible file appears ready to proceed into execution handoff, even though the live execution record has not started yet.",
      blockers: [],
      nextSteps:
        input.audience === "landlord"
          ? [
              "Use the current lease workflow to begin the next supported execution-related step.",
              "Keep this workspace as the structured handoff between readiness and the live execution process.",
            ]
          : [
              "Your file currently appears ready to move forward.",
              "Watch for the next tenant-visible instruction before any lease completion step begins.",
            ],
      timelineEvent: {
        title: "Ready for execution",
        description:
          "The visible final-stage requirements now appear organized enough to move into execution handoff.",
        actionRequired: false,
      },
    };
  }

  if (
    input.executionReadiness.readinessState === "awaiting_next_action" ||
    input.executionReadiness.readinessState === "preparing_for_execution"
  ) {
    return {
      executionState: "awaiting_execution_action",
      label: stateLabel("awaiting_execution_action"),
      summary: "Lease execution workspace",
      explanation:
        input.audience === "tenant"
          ? "Preparing to complete your lease. The final handoff is not visible yet, but the file is moving toward the next execution step."
          : "The file is approaching execution handoff, but the next supported execution-related step is not visible yet.",
      blockers: input.executionReadiness.blockers,
      nextSteps: input.executionReadiness.nextActions,
      timelineEvent: null,
    };
  }

  return {
    executionState: "not_ready_for_execution",
    label: stateLabel("not_ready_for_execution"),
    summary: "Lease execution workspace",
    explanation:
      "This file is not ready to move into execution yet because the visible readiness and handoff requirements are still earlier in the workflow.",
    blockers: input.executionReadiness.blockers,
    nextSteps: input.executionReadiness.nextActions,
    timelineEvent: null,
  };
}
