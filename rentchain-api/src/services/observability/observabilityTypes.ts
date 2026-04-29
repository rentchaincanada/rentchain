export const SYSTEM_OBSERVABILITY_EVENTS_COLLECTION = "systemObservabilityEvents";

export const SYSTEM_OBSERVABILITY_WORKFLOWS = [
  "application",
  "screening",
  "lease",
  "payment",
  "maintenance",
  "messages",
  "institutional",
  "dashboard",
  "analytics",
] as const;

export type SystemObservabilityEventType =
  | "workflow_started"
  | "workflow_completed"
  | "workflow_blocked"
  | "action_failed"
  | "integration_warning"
  | "data_quality_warning";

export type SystemObservabilityWorkflow = (typeof SYSTEM_OBSERVABILITY_WORKFLOWS)[number];

export type SystemObservabilitySeverity = "info" | "warning" | "critical";
export type SystemObservabilityActorType = "tenant" | "landlord" | "admin" | "system";
export type SystemObservabilityStatus = "open" | "resolved" | "ignored";

export type SystemObservabilitySafeContext = {
  route?: string;
  actionKey?: string;
  resourceType?: string;
  resourceId?: string;
};

export type SystemObservabilityEventSource = {
  kind: "canonical_event" | "system_observability";
  sourceEventId?: string | null;
};

export type SystemObservabilityEventInput = {
  eventType: SystemObservabilityEventType;
  workflow: SystemObservabilityWorkflow;
  severity: SystemObservabilitySeverity;
  actorType: SystemObservabilityActorType;
  status?: SystemObservabilityStatus;
  title: string;
  description: string;
  safeContext?: SystemObservabilitySafeContext | null;
  idempotencyKey?: string | null;
  source?: SystemObservabilityEventSource | null;
  occurredAt?: string | number | Date | null;
  resolvedAt?: string | number | Date | null;
};

export type SystemObservabilityEventRecord = {
  id: string;
  version: "v1";
  eventType: SystemObservabilityEventType;
  workflow: SystemObservabilityWorkflow;
  severity: SystemObservabilitySeverity;
  actorType: SystemObservabilityActorType;
  status: SystemObservabilityStatus;
  title: string;
  description: string;
  safeContext: SystemObservabilitySafeContext | null;
  idempotencyKey: string | null;
  source: SystemObservabilityEventSource;
  occurredAt: string;
  recordedAt: string;
  resolvedAt: string | null;
};

export type SystemObservabilitySummary = {
  generatedAt: string;
  totals: {
    openCritical: number;
    openWarnings: number;
    resolvedLast7Days: number;
  };
  workflows: Array<{
    workflow: SystemObservabilityWorkflow;
    openCritical: number;
    openWarnings: number;
    recentCompleted: number;
    health: "healthy" | "watch" | "attention";
  }>;
  topIssues: Array<{
    title: string;
    workflow: SystemObservabilityWorkflow;
    severity: SystemObservabilitySeverity;
    count: number;
    lastSeenAt: string;
  }>;
};
