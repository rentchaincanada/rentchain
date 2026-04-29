import {
  SYSTEM_OBSERVABILITY_EVENTS_COLLECTION,
  SYSTEM_OBSERVABILITY_WORKFLOWS,
  type SystemObservabilityEventRecord,
  type SystemObservabilitySeverity,
  type SystemObservabilitySummary,
  type SystemObservabilityWorkflow,
} from "./observabilityTypes";
import { db } from "../../config/firebase";

function toMillis(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveWorkflowHealth(input: {
  openCritical: number;
  openWarnings: number;
}): "healthy" | "watch" | "attention" {
  if (input.openCritical > 0) return "attention";
  if (input.openWarnings > 0) return "watch";
  return "healthy";
}

function severityRank(value: SystemObservabilitySeverity): number {
  if (value === "critical") return 3;
  if (value === "warning") return 2;
  return 1;
}

export async function deriveSystemObservabilitySummary(input?: {
  period?: "7d" | "30d" | null;
  now?: Date;
}): Promise<SystemObservabilitySummary> {
  const now = input?.now || new Date();
  const period = input?.period === "30d" ? "30d" : "7d";
  const recentWindowMs = period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const resolvedWindowMs = 7 * 24 * 60 * 60 * 1000;
  const recentCutoff = now.getTime() - recentWindowMs;
  const resolvedCutoff = now.getTime() - resolvedWindowMs;

  const snapshot = await db.collection(SYSTEM_OBSERVABILITY_EVENTS_COLLECTION).get();
  const events = (snapshot.docs || [])
    .map((doc: any) => (doc.data ? doc.data() : null) as SystemObservabilityEventRecord | null)
    .filter(Boolean) as SystemObservabilityEventRecord[];

  const openEvents = events.filter((event) => event.status === "open");
  const openCritical = openEvents.filter((event) => event.severity === "critical").length;
  const openWarnings = openEvents.filter((event) => event.severity === "warning").length;
  const resolvedLast7Days = events.filter((event) => {
    if (event.status !== "resolved") return false;
    return toMillis(event.resolvedAt || event.occurredAt) >= resolvedCutoff;
  }).length;

  const workflows = SYSTEM_OBSERVABILITY_WORKFLOWS.map((workflow) => {
    const workflowEvents = events.filter((event) => event.workflow === workflow);
    const workflowOpenCritical = workflowEvents.filter(
      (event) => event.status === "open" && event.severity === "critical"
    ).length;
    const workflowOpenWarnings = workflowEvents.filter(
      (event) => event.status === "open" && event.severity === "warning"
    ).length;
    const recentCompleted = workflowEvents.filter(
      (event) => event.eventType === "workflow_completed" && toMillis(event.occurredAt) >= recentCutoff
    ).length;

    return {
      workflow,
      openCritical: workflowOpenCritical,
      openWarnings: workflowOpenWarnings,
      recentCompleted,
      health: deriveWorkflowHealth({
        openCritical: workflowOpenCritical,
        openWarnings: workflowOpenWarnings,
      }),
    };
  });

  const groupedIssues = new Map<
    string,
    {
      title: string;
      workflow: SystemObservabilityWorkflow;
      severity: SystemObservabilitySeverity;
      count: number;
      lastSeenAt: string;
    }
  >();

  openEvents
    .filter((event) => event.severity === "warning" || event.severity === "critical")
    .forEach((event) => {
      const key = `${event.workflow}::${event.severity}::${event.title}`;
      const existing = groupedIssues.get(key);
      if (!existing) {
        groupedIssues.set(key, {
          title: event.title,
          workflow: event.workflow,
          severity: event.severity,
          count: 1,
          lastSeenAt: event.occurredAt,
        });
        return;
      }

      groupedIssues.set(key, {
        ...existing,
        count: existing.count + 1,
        lastSeenAt: toMillis(event.occurredAt) > toMillis(existing.lastSeenAt) ? event.occurredAt : existing.lastSeenAt,
      });
    });

  const topIssues = Array.from(groupedIssues.values())
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;
      if (b.count !== a.count) return b.count - a.count;
      return toMillis(b.lastSeenAt) - toMillis(a.lastSeenAt);
    })
    .slice(0, 5);

  return {
    generatedAt: now.toISOString(),
    totals: {
      openCritical,
      openWarnings,
      resolvedLast7Days,
    },
    workflows,
    topIssues,
  };
}
