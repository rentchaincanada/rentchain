import type { LandlordAgentDecision } from "../analytics/analyticsTypes";
import type { Decision } from "./decisionEngine";
import type {
  DecisionInboxItem,
  DecisionInboxResult,
  DecisionInboxSeverity,
  DecisionInboxSource,
  DecisionInboxStatus,
  DecisionInboxType,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowQueue,
  DecisionWorkflowState,
} from "./decisionInboxTypes";
import { deriveDecisionWorkflowRouting } from "./deriveDecisionWorkflowRouting";
import { deriveDelinquencyActions } from "../delinquency/deriveDelinquencyActions";
import { deriveAutomatedWorkflowTransitions } from "../automatedWorkflows/deriveAutomatedWorkflowTransitions";

type SourceDecision = Decision & { latestAction?: unknown };

export type DeriveDecisionInboxInput = {
  leaseDecisions?: SourceDecision[] | null;
  analyticsDecisions?: LandlordAgentDecision[] | null;
  filters?: {
    severity?: unknown;
    status?: unknown;
    type?: unknown;
    queue?: unknown;
    workflowState?: unknown;
    escalationLevel?: unknown;
  } | null;
};

const KNOWN_SEVERITIES = new Set<DecisionInboxSeverity>(["critical", "high", "medium", "low", "info", "unknown"]);
const KNOWN_STATUSES = new Set<DecisionInboxStatus>(["open", "pending", "blocked", "resolved", "dismissed", "unknown"]);
const KNOWN_TYPES = new Set<DecisionInboxType>([
  "lease",
  "screening",
  "maintenance",
  "compliance",
  "admin",
  "property",
  "tenant",
  "billing",
  "unknown",
]);
const KNOWN_QUEUES = new Set<DecisionWorkflowQueue>([
  "lease_review",
  "delinquency_review",
  "screening_review",
  "maintenance_review",
  "compliance_review",
  "admin_review",
  "general_review",
]);
const KNOWN_WORKFLOW_STATES = new Set<DecisionWorkflowState>([
  "new",
  "triaged",
  "under_review",
  "waiting_context",
  "escalated",
  "resolved",
  "archived",
]);
const KNOWN_ESCALATION_LEVELS = new Set<DecisionWorkflowEscalationLevel>([
  "none",
  "attention",
  "urgent",
  "critical",
]);

function asString(value: unknown, max = 500): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function titleCase(value: unknown): string {
  const text = asString(value, 120);
  if (!text) return "Decision";
  return text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fallbackId(source: DecisionInboxSource, rawId: unknown, type: unknown) {
  return cleanId(["decision_inbox", source, rawId || type || "unknown"].join(":")) || "decision_inbox:unknown";
}

function decisionEngineSeverity(value: unknown): DecisionInboxSeverity {
  const severity = asString(value, 40);
  if (severity === "critical") return "critical";
  if (severity === "warning") return "medium";
  if (severity === "info") return "info";
  return "unknown";
}

function analyticsSeverity(value: unknown): DecisionInboxSeverity {
  const priority = asString(value, 40);
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  if (priority === "low") return "low";
  return "unknown";
}

function decisionStatus(value: unknown): DecisionInboxStatus {
  const status = asString(value, 40);
  if (status === "dismissed") return "dismissed";
  if (status === "resolved" || status === "accepted") return "resolved";
  if (status === "reviewed" || status === "snoozed" || status === "assigned" || status === "surfaced") return "pending";
  if (status === "detected" || !status) return "open";
  return "unknown";
}

function analyticsStatus(decision: LandlordAgentDecision): DecisionInboxStatus {
  if (decision.executionState === "blocked" || decision.executionState === "unsafe_duplicate") return "blocked";
  if (decision.state === "dismissed") return "dismissed";
  if (decision.state === "executed") return "resolved";
  if (decision.state === "reviewed" || decision.state === "snoozed") return "pending";
  if (decision.state === "pending") return "open";
  return "unknown";
}

function typeFromDecisionType(value: unknown): DecisionInboxType {
  const type = asString(value, 120);
  if (!type) return "unknown";
  if (type.includes("rent") || type.includes("payment") || type.includes("revenue")) return "billing";
  if (type.includes("lease") || type.includes("occupancy") || type.includes("renewal") || type.includes("vacancy")) return "lease";
  if (type.includes("screening") || type.includes("application_conversion") || type.includes("application")) return "screening";
  if (type.includes("maintenance")) return "maintenance";
  if (type.includes("property")) return "property";
  return "unknown";
}

function destinationForLeaseDecision(decision: SourceDecision): string | null {
  const leaseId = asString(decision.leaseId, 240);
  if (!leaseId) return null;
  const type = asString(decision.decisionType, 120) || "";
  if (type.includes("rent") || type.includes("payment")) return `/leases/${encodeURIComponent(leaseId)}/ledger`;
  return `/leases/${encodeURIComponent(leaseId)}/summary`;
}

function relatedEntityForLeaseDecision(decision: SourceDecision): DecisionInboxItem["relatedEntity"] {
  const leaseId = asString(decision.leaseId, 240);
  if (leaseId) {
    return { kind: "lease", id: leaseId, label: `Lease ${leaseId}` };
  }
  const propertyId = asString(decision.propertyId, 240);
  if (propertyId) {
    return { kind: "property", id: propertyId, label: `Property ${propertyId}` };
  }
  return null;
}

function relatedEntityForAnalyticsDecision(decision: LandlordAgentDecision): DecisionInboxItem["relatedEntity"] {
  const resourceType = asString(decision.executionMapping?.resourceType, 120);
  const resourceId = asString(decision.executionMapping?.resourceId, 240);
  if (resourceType && resourceId) {
    if (resourceType === "rental_application") {
      return { kind: "application", id: resourceId, label: `Application ${resourceId}` };
    }
    if (resourceType === "work_order") {
      return { kind: "maintenance_request", id: resourceId, label: `Work order ${resourceId}` };
    }
    if (resourceType === "lease") {
      return { kind: "lease", id: resourceId, label: `Lease ${resourceId}` };
    }
  }
  const propertyId = decision.supportingSignals?.map((signal) => asString(signal.propertyId, 240)).find(Boolean);
  if (propertyId) return { kind: "property", id: propertyId, label: `Property ${propertyId}` };
  return null;
}

export function decisionInboxItemFromLeaseDecision(decision: SourceDecision): DecisionInboxItem {
  const type = typeFromDecisionType(decision.decisionType);
  const base: Omit<DecisionInboxItem, "workflow"> = {
    id: asString(decision.decisionId, 600) || fallbackId("lease_ledger", decision.decisionId, decision.decisionType),
    title: titleCase(decision.decisionType),
    description: asString(decision.reason, 1000) || "Decision context is available for review.",
    severity: decisionEngineSeverity(decision.severity),
    status: decisionStatus(decision.status),
    type,
    source: "lease_ledger",
    relatedEntity: relatedEntityForLeaseDecision(decision),
    destination: destinationForLeaseDecision(decision),
    automationEligible: false,
    createdAt: normalizeDate(decision.createdAt),
    updatedAt: normalizeDate(decision.updatedAt),
  };
  const item: DecisionInboxItem = {
    ...base,
    workflow: deriveDecisionWorkflowRouting({ ...base, decisionType: decision.decisionType }),
  };
  const delinquencyActions = deriveDelinquencyActions(item);
  return delinquencyActions.length ? { ...item, delinquencyActions } : item;
}

export function decisionInboxItemFromAnalyticsDecision(decision: LandlordAgentDecision): DecisionInboxItem {
  const base: Omit<DecisionInboxItem, "workflow"> = {
    id: asString(decision.id, 600) || fallbackId("analytics", decision.id, decision.decisionType),
    title: asString(decision.actionLabel || decision.recommendedAction, 240) || titleCase(decision.decisionType),
    description: asString(decision.explanation || decision.recommendedAction, 1000) || "Analytics decision context is available for review.",
    severity: analyticsSeverity(decision.priority),
    status: analyticsStatus(decision),
    type: typeFromDecisionType(decision.decisionType),
    source: "analytics",
    relatedEntity: relatedEntityForAnalyticsDecision(decision),
    destination: asString(decision.destination || decision.href, 500),
    automationEligible: false,
    createdAt: null,
    updatedAt: normalizeDate(decision.reviewedAt || decision.executedAt || decision.executionOutcomeAt),
  };
  const item: DecisionInboxItem = {
    ...base,
    workflow: deriveDecisionWorkflowRouting({
      ...base,
      decisionType: decision.decisionType,
      workflowCategory: decision.workflowCategory,
    }),
  };
  const delinquencyActions = deriveDelinquencyActions(item);
  return delinquencyActions.length ? { ...item, delinquencyActions } : item;
}

function filterValue<T extends string>(value: unknown, known: Set<T>): T | null {
  const raw = asString(value, 80)?.toLowerCase();
  if (!raw || raw === "all") return null;
  return known.has(raw as T) ? (raw as T) : null;
}

function uniqueSorted<T extends string>(values: T[], known: readonly T[]): T[] {
  const present = new Set(values);
  return known.filter((value) => present.has(value));
}

export function deriveDecisionInbox(input: DeriveDecisionInboxInput): DecisionInboxResult {
  const baseItems = [
    ...(input.analyticsDecisions || []).map(decisionInboxItemFromAnalyticsDecision),
    ...(input.leaseDecisions || []).map(decisionInboxItemFromLeaseDecision),
  ];
  const automationByDecisionId = new Map(
    deriveAutomatedWorkflowTransitions({ decisions: baseItems }).workflows.map((workflow) => [workflow.decisionId, workflow])
  );
  const allItems = baseItems.map((item) => ({
    ...item,
    automatedWorkflow: automationByDecisionId.get(item.id),
  })).sort((a, b) => {
    const severityOrder: Record<DecisionInboxSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
      unknown: 5,
    };
    return (
      severityOrder[a.severity] - severityOrder[b.severity] ||
      (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "") ||
      a.id.localeCompare(b.id)
    );
  });

  const severity = filterValue(input.filters?.severity, KNOWN_SEVERITIES);
  const status = filterValue(input.filters?.status, KNOWN_STATUSES);
  const type = filterValue(input.filters?.type, KNOWN_TYPES);
  const queue = filterValue(input.filters?.queue, KNOWN_QUEUES);
  const workflowState = filterValue(input.filters?.workflowState, KNOWN_WORKFLOW_STATES);
  const escalationLevel = filterValue(input.filters?.escalationLevel, KNOWN_ESCALATION_LEVELS);
  const items = allItems.filter((item) => {
    if (severity && item.severity !== severity) return false;
    if (status && item.status !== status) return false;
    if (type && item.type !== type) return false;
    if (queue && item.workflow.queue !== queue) return false;
    if (workflowState && item.workflow.workflowState !== workflowState) return false;
    if (escalationLevel && item.workflow.escalationLevel !== escalationLevel) return false;
    return true;
  });

  return {
    items,
    filters: {
      severity: uniqueSorted(
        allItems.map((item) => item.severity),
        ["critical", "high", "medium", "low", "info", "unknown"]
      ),
      status: uniqueSorted(
        allItems.map((item) => item.status),
        ["open", "pending", "blocked", "resolved", "dismissed", "unknown"]
      ),
      type: uniqueSorted(
        allItems.map((item) => item.type),
        ["lease", "screening", "maintenance", "compliance", "admin", "property", "tenant", "billing", "unknown"]
      ),
      queue: uniqueSorted(
        allItems.map((item) => item.workflow.queue),
        [
          "lease_review",
          "delinquency_review",
          "screening_review",
          "maintenance_review",
          "compliance_review",
          "admin_review",
          "general_review",
        ]
      ),
      workflowState: uniqueSorted(
        allItems.map((item) => item.workflow.workflowState),
        ["new", "triaged", "under_review", "waiting_context", "escalated", "resolved", "archived"]
      ),
      escalationLevel: uniqueSorted(
        allItems.map((item) => item.workflow.escalationLevel),
        ["none", "attention", "urgent", "critical"]
      ),
    },
    summary: {
      total: items.length,
      critical: items.filter((item) => item.severity === "critical").length,
      high: items.filter((item) => item.severity === "high").length,
      open: items.filter((item) => item.status === "open").length,
      blocked: items.filter((item) => item.status === "blocked").length,
    },
    workflowSummary: {
      new: items.filter((item) => item.workflow.workflowState === "new").length,
      underReview: items.filter((item) => item.workflow.workflowState === "under_review").length,
      escalated: items.filter((item) => item.workflow.workflowState === "escalated").length,
      critical: items.filter((item) => item.workflow.escalationLevel === "critical").length,
    },
    automationSummary: deriveAutomatedWorkflowTransitions({ decisions: items }).summary,
  };
}
