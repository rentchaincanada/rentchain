import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Building2, ClipboardList, FileText, Home, ReceiptText, ShieldCheck } from "lucide-react";
import { fetchDashboardSummary, type DashboardSummaryData } from "@/api/dashboard";
import {
  fetchDecisionInbox,
  type DecisionInboxItem,
  type DecisionInboxResponse,
} from "@/api/decisionInboxApi";
import { getActiveLeasesForLandlord, type LandlordActiveLease } from "@/api/leasesApi";
import { fetchProperties, type Property } from "@/api/propertiesApi";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";

type CommandCenterCategory =
  | "lease_lifecycle"
  | "payments"
  | "occupancy"
  | "screening"
  | "documents"
  | "review_workflow";

type CommandCenterSeverity = "critical" | "warning" | "info";
type CommandCenterPriorityGroup = "critical" | "needs_review" | "upcoming" | "informational";
type CommandCenterFilter =
  | "all"
  | "critical"
  | "warnings"
  | "needs_review"
  | "upcoming"
  | "open_decisions"
  | "delinquent"
  | "informational";
type SavedOperationalView = "all_operational" | "needs_review" | "high_risk" | "upcoming_deadlines" | "unassigned" | "delinquent";
type WorkflowTypeFilter = "all" | CommandCenterCategory;
type ReviewStatusFilter = "all" | "open" | "review_needed" | "informational";
type AssignmentFilter = "all" | "assigned" | "unassigned";
type EscalationFilter = "all" | "escalated" | "not_escalated";
type TimingRiskFilter = "all" | "delinquent" | "upcoming" | "high_risk";

type CommandCenterFilterOptions = {
  search?: string;
  filter?: CommandCenterFilter;
  workflowType?: WorkflowTypeFilter;
  reviewStatus?: ReviewStatusFilter;
  assignment?: AssignmentFilter;
  escalation?: EscalationFilter;
  timingRisk?: TimingRiskFilter;
};

export type CommandCenterSignal = {
  id: string;
  category: CommandCenterCategory;
  severity: CommandCenterSeverity;
  priorityGroup: CommandCenterPriorityGroup;
  title: string;
  description: string;
  contextLabel: string;
  destination: string;
  source: string;
  workflowStatus: string;
  reviewStatus: string;
  financialStatus?: string | null;
  nextActionLabel: string;
  assignmentState?: "assigned" | "unassigned";
  assignmentLabel?: string;
  escalationState?: "escalated" | "not_escalated";
  escalationLabel?: string;
  timingState?: "upcoming" | "current";
  riskState?: "delinquent" | "high_risk" | "review" | "informational";
};

type CategoryConfig = {
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  destination: string;
};

const CATEGORY_CONFIG: Record<CommandCenterCategory, CategoryConfig> = {
  lease_lifecycle: {
    label: "Lease lifecycle",
    description: "Lease execution, ending-soon, and readiness signals.",
    icon: ClipboardList,
    destination: "/leases",
  },
  payments: {
    label: "Payments / obligations",
    description: "Delinquency, unmatched evidence, and obligation review signals.",
    icon: ReceiptText,
    destination: "/payments",
  },
  occupancy: {
    label: "Occupancy",
    description: "Vacancy, upcoming occupancy, and review-needed state conflicts.",
    icon: Home,
    destination: "/properties",
  },
  screening: {
    label: "Screening",
    description: "Consent, provider setup, and manual screening workflow signals.",
    icon: ShieldCheck,
    destination: "/applications",
  },
  documents: {
    label: "Documents / workspace",
    description: "Lease package, signature, and tenant workspace document readiness.",
    icon: FileText,
    destination: "/leases",
  },
  review_workflow: {
    label: "Operational review",
    description: "Decision workflow items requiring human review or ownership.",
    icon: AlertTriangle,
    destination: "/decision-inbox",
  },
};

const CATEGORY_ORDER: CommandCenterCategory[] = [
  "lease_lifecycle",
  "payments",
  "occupancy",
  "screening",
  "documents",
  "review_workflow",
];

const PRIORITY_GROUPS: Array<{
  group: CommandCenterPriorityGroup;
  label: string;
  description: string;
  tone: CommandCenterSeverity;
}> = [
  {
    group: "critical",
    label: "Critical",
    description: "Highest-priority items that need prompt human review.",
    tone: "critical",
  },
  {
    group: "needs_review",
    label: "Needs review",
    description: "Operational issues that need staff review before the source workflow progresses.",
    tone: "warning",
  },
  {
    group: "upcoming",
    label: "Upcoming",
    description: "Forward-looking lease, occupancy, and workflow timing signals.",
    tone: "info",
  },
  {
    group: "informational",
    label: "Informational",
    description: "Lower-risk visibility signals and non-urgent operational context.",
    tone: "info",
  },
];

const INACTIVE_DECISION_STATUSES = new Set(["resolved", "dismissed"]);
const COMMAND_CENTER_FILTERS: Array<{ value: CommandCenterFilter; label: string }> = [
  { value: "all", label: "All operational" },
  { value: "critical", label: "Critical" },
  { value: "warnings", label: "Warnings" },
  { value: "needs_review", label: "Needs review" },
  { value: "upcoming", label: "Upcoming" },
  { value: "open_decisions", label: "Open decisions" },
  { value: "delinquent", label: "Delinquent" },
  { value: "informational", label: "Informational" },
];

const SAVED_OPERATIONAL_VIEWS: Array<{ value: SavedOperationalView; label: string; description: string }> = [
  { value: "all_operational", label: "All Operational", description: "Every visible source workflow signal." },
  { value: "needs_review", label: "Needs Review", description: "Items waiting for staff review or decision handling." },
  { value: "high_risk", label: "High Risk", description: "Critical or escalated items that should surface first." },
  { value: "upcoming_deadlines", label: "Upcoming Deadlines", description: "Forward-looking lease, occupancy, and workflow timing." },
  { value: "unassigned", label: "Unassigned", description: "Items without a clear workflow owner." },
  { value: "delinquent", label: "Delinquent", description: "Payment, obligation, and delinquency review work." },
];

const WORKFLOW_TYPE_OPTIONS: Array<{ value: WorkflowTypeFilter; label: string }> = [
  { value: "all", label: "All workflow types" },
  ...CATEGORY_ORDER.map((category) => ({ value: category, label: CATEGORY_CONFIG[category].label })),
];

const REVIEW_STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: "all", label: "All review states" },
  { value: "open", label: "Open decisions" },
  { value: "review_needed", label: "Needs review" },
  { value: "informational", label: "Informational only" },
];

const ASSIGNMENT_OPTIONS: Array<{ value: AssignmentFilter; label: string }> = [
  { value: "all", label: "All assignment states" },
  { value: "assigned", label: "Assigned / owned" },
  { value: "unassigned", label: "Unassigned" },
];

const ESCALATION_OPTIONS: Array<{ value: EscalationFilter; label: string }> = [
  { value: "all", label: "All escalation states" },
  { value: "escalated", label: "Escalated" },
  { value: "not_escalated", label: "Not escalated" },
];

const TIMING_RISK_OPTIONS: Array<{ value: TimingRiskFilter; label: string }> = [
  { value: "all", label: "All timing / risk" },
  { value: "delinquent", label: "Delinquent" },
  { value: "upcoming", label: "Upcoming / deadline" },
  { value: "high_risk", label: "High risk" },
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function operationalCopy(value: string | null | undefined, fallback: string) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  const known: Record<string, string> = {
    lease_status_active_but_execution_incomplete: "Lease is marked active, but signing or execution is incomplete.",
    ledger_payment_activity_without_provider_payment_setup:
      "Payment activity exists, but payment setup still needs operational review.",
    active_lease_on_vacant_unit: "Lease and unit occupancy signals conflict and need review.",
    occupied_unit_without_active_executed_lease: "Unit appears occupied without a fully executed active lease.",
    tenant_active_without_executed_occupancy: "Tenant and lease occupancy signals need review.",
  };
  if (known[normalized]) return known[normalized];
  if (/^[a-z0-9]+(?:_[a-z0-9]+){2,}$/.test(normalized)) return label(normalized);
  return raw;
}

function operationalTitle(value: string | null | undefined, fallback: string) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized === "needs review") return fallback;
  if (normalized === "lease_status_active_but_execution_incomplete") return "Active lease needs execution review";
  if (normalized === "ledger_payment_activity_without_provider_payment_setup") return "Payment setup needs review";
  return operationalCopy(raw, fallback);
}

function formatDate(value?: string | null) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value?: string | null, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function severityFromDecision(item: DecisionInboxItem): CommandCenterSeverity {
  if (item.severity === "critical" || item.severity === "high" || item.status === "blocked") return "critical";
  if (item.severity === "medium" || item.workflow?.escalationLevel === "attention") return "warning";
  return "info";
}

function priorityRank(group: CommandCenterPriorityGroup) {
  return PRIORITY_GROUPS.findIndex((item) => item.group === group);
}

function severityRank(severity: CommandCenterSeverity) {
  return { critical: 0, warning: 1, info: 2 }[severity];
}

function priorityFromDecision(item: DecisionInboxItem, category: CommandCenterCategory): CommandCenterPriorityGroup {
  if (
    item.status === "blocked" ||
    item.workflow?.workflowState === "escalated" ||
    item.workflow?.escalationLevel === "critical" ||
    category === "payments"
  ) {
    return "critical";
  }
  if (
    item.severity === "high" ||
    item.severity === "medium" ||
    item.workflow?.workflowState === "waiting_context" ||
    item.workflow?.escalationLevel === "urgent" ||
    item.workflow?.escalationLevel === "attention"
  ) {
    return "needs_review";
  }
  return "informational";
}

function nextActionForDecision(item: DecisionInboxItem, category: CommandCenterCategory) {
  if (category === "payments") return "Review payment evidence";
  if (category === "screening") return "Review screening workflow";
  if (category === "lease_lifecycle") return "Review lease readiness";
  if (category === "occupancy") return "Review occupancy context";
  return "Review source workflow";
}

function assignmentForDecision(item: DecisionInboxItem): Pick<CommandCenterSignal, "assignmentState" | "assignmentLabel"> {
  const owner = String(item.workflow?.ownershipType || "").trim();
  if (!owner || owner === "system") return { assignmentState: "unassigned", assignmentLabel: "Unassigned" };
  return { assignmentState: "assigned", assignmentLabel: `${label(owner)} owned` };
}

function escalationForDecision(item: DecisionInboxItem): Pick<CommandCenterSignal, "escalationState" | "escalationLabel"> {
  const escalationLevel = String(item.workflow?.escalationLevel || "none").trim();
  if (["critical", "urgent", "attention"].includes(escalationLevel)) {
    return { escalationState: "escalated", escalationLabel: label(escalationLevel) };
  }
  return { escalationState: "not_escalated", escalationLabel: "Not escalated" };
}

function riskStateForSignal(params: {
  category: CommandCenterCategory;
  severity: CommandCenterSeverity;
  priorityGroup: CommandCenterPriorityGroup;
  source?: string | null;
}): CommandCenterSignal["riskState"] {
  if (params.category === "payments" || /delinqu/i.test(String(params.source || ""))) return "delinquent";
  if (params.severity === "critical" || params.priorityGroup === "critical") return "high_risk";
  if (params.priorityGroup === "needs_review" || params.severity === "warning") return "review";
  return "informational";
}

function signalTriageDefaults(params: {
  category: CommandCenterCategory;
  severity: CommandCenterSeverity;
  priorityGroup: CommandCenterPriorityGroup;
  source?: string | null;
  assignmentState?: CommandCenterSignal["assignmentState"];
  assignmentLabel?: string;
  escalationState?: CommandCenterSignal["escalationState"];
  escalationLabel?: string;
}): Pick<
  CommandCenterSignal,
  "assignmentState" | "assignmentLabel" | "escalationState" | "escalationLabel" | "timingState" | "riskState"
> {
  return {
    assignmentState: params.assignmentState || "unassigned",
    assignmentLabel: params.assignmentLabel || "Unassigned",
    escalationState: params.escalationState || (params.severity === "critical" ? "escalated" : "not_escalated"),
    escalationLabel: params.escalationLabel || (params.severity === "critical" ? "Critical review" : "Not escalated"),
    timingState: params.priorityGroup === "upcoming" ? "upcoming" : "current",
    riskState: riskStateForSignal(params),
  };
}

function decisionCategory(item: DecisionInboxItem): CommandCenterCategory {
  if (item.workflow?.queue === "delinquency_review" || item.type === "billing") return "payments";
  if (item.workflow?.queue === "screening_review" || item.type === "screening") return "screening";
  if (item.type === "property") return "occupancy";
  if (item.type === "lease" || item.workflow?.queue === "lease_review") return "lease_lifecycle";
  return "review_workflow";
}

function leaseLabel(lease: LandlordActiveLease) {
  const property = lease.propertyName || lease.propertyLabel || "Property";
  const unit = lease.unitLabel || lease.unitNumber || "Unit";
  const tenant = lease.tenantName ? ` · ${lease.tenantName}` : "";
  return `${property} · ${unit}${tenant}`;
}

function propertyLabel(property: Property) {
  return property.name || property.addressLine1 || "Property";
}

function looksLikeInternalId(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^[A-Za-z0-9_-]{16,}$/.test(text)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function hasRawReferenceLabel(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /^(Lease|Property|Tenant|Unit)\s+[A-Za-z0-9_-]{12,}$/i.test(text);
}

function leaseIdFromDestination(value: unknown) {
  const text = String(value || "");
  const match = text.match(/\/leases\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function buildLeaseLookup(leases: LandlordActiveLease[]) {
  const lookup = new Map<string, LandlordActiveLease>();
  for (const lease of leases) {
    [lease.id, (lease as any).leaseId, lease.unitId, lease.tenantId, lease.propertyId]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .forEach((key) => lookup.set(key, lease));
  }
  return lookup;
}

function buildPropertyLookup(properties: Property[]) {
  const lookup = new Map<string, Property>();
  for (const property of properties) {
    String(property.id || "").trim() && lookup.set(String(property.id), property);
    for (const unit of property.units || []) {
      const unitId = String((unit as any)?.id || "").trim();
      if (unitId) lookup.set(unitId, property);
    }
  }
  return lookup;
}

function resolveDecisionContextLabel(
  item: DecisionInboxItem,
  lookups: { leases: Map<string, LandlordActiveLease>; properties: Map<string, Property> }
) {
  const relatedId = String(item.relatedEntity?.id || "").trim();
  const destinationLeaseId = leaseIdFromDestination(item.destination);
  if (item.relatedEntity?.kind === "property") {
    const property = relatedId ? lookups.properties.get(relatedId) : null;
    if (property) return propertyLabel(property);
  }
  const lease = [relatedId, destinationLeaseId]
    .filter(Boolean)
    .map((id) => lookups.leases.get(String(id)))
    .find(Boolean);
  if (lease) return leaseLabel(lease);

  const property = relatedId ? lookups.properties.get(relatedId) : null;
  if (property) return propertyLabel(property);

  const existingLabel = String(item.relatedEntity?.label || "").trim();
  if (existingLabel && !looksLikeInternalId(existingLabel) && !hasRawReferenceLabel(existingLabel)) return existingLabel;

  if (item.workflow?.queue === "delinquency_review") return "Lease ledger review";
  if (item.workflow?.queue === "screening_review") return "Screening workflow review";
  if (item.workflow?.queue === "lease_review") return "Lease workflow review";
  if (item.relatedEntity?.kind === "property") return "Property review";
  if (item.relatedEntity?.kind === "tenant") return "Tenant review";
  if (item.relatedEntity?.kind === "lease") return "Lease review";
  return "Operational review";
}

export function prioritizeOperationalItems(signals: CommandCenterSignal[]): CommandCenterSignal[] {
  return [...signals].sort((a, b) => {
    return (
      priorityRank(a.priorityGroup) - priorityRank(b.priorityGroup) ||
      severityRank(a.severity) - severityRank(b.severity) ||
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
    );
  });
}

function withTriageMetadata(signal: CommandCenterSignal): CommandCenterSignal {
  return {
    ...signal,
    ...signalTriageDefaults({
      category: signal.category,
      severity: signal.severity,
      priorityGroup: signal.priorityGroup,
      source: signal.source,
      assignmentState: signal.assignmentState,
      assignmentLabel: signal.assignmentLabel,
      escalationState: signal.escalationState,
      escalationLabel: signal.escalationLabel,
    }),
  };
}

export function deriveCommandCenterSignals(input: {
  decisions?: DecisionInboxItem[];
  leases?: LandlordActiveLease[];
  properties?: Property[];
  now?: Date;
}): CommandCenterSignal[] {
  const now = input.now || new Date();
  const signals: CommandCenterSignal[] = [];
  const leases = input.leases || [];
  const properties = input.properties || [];
  const lookups = {
    leases: buildLeaseLookup(leases),
    properties: buildPropertyLookup(properties),
  };

  for (const item of input.decisions || []) {
    if (INACTIVE_DECISION_STATUSES.has(String(item.status))) continue;
    const category = decisionCategory(item);
    const priorityGroup = priorityFromDecision(item, category);
    const severity = severityFromDecision(item);
    signals.push({
      id: `decision:${item.id}`,
      category,
      severity,
      priorityGroup,
      title: item.title || "Operational review item",
      description: item.description || "Review the source workflow before taking any action.",
      contextLabel: resolveDecisionContextLabel(item, lookups),
      destination: item.destination || CATEGORY_CONFIG[category].destination,
      source: `Decision inbox · ${label(item.workflow?.queue || "general_review")}`,
      workflowStatus: label(item.workflow?.workflowState || "new"),
      reviewStatus: label(item.status || "open"),
      financialStatus: category === "payments" ? "Review required" : null,
      nextActionLabel: nextActionForDecision(item, category),
      ...assignmentForDecision(item),
      ...escalationForDecision(item),
    });
  }

  for (const lease of leases) {
    const baseLabel = leaseLabel(lease);
    const leaseDestination = `/leases/${encodeURIComponent(lease.id)}/ledger`;
    const endingIn = daysUntil(lease.endDate, now);
    const executionStatus = lease.leaseExecution?.executionStatus;
    const signatureStatus = lease.signatureStatus;

    if (lease.stateCoherence?.flags?.requiresReview || lease.stateCoherence?.flags?.hasStateConflict) {
      signals.push({
        id: `lease-coherence:${lease.id}`,
        category: "occupancy",
        severity: "warning",
        priorityGroup: lease.stateCoherence?.flags?.hasStateConflict ? "critical" : "needs_review",
        title: operationalTitle(lease.stateCoherence.coherenceReason || lease.stateCoherence.coherenceLabel, "Occupancy review needed"),
        description: operationalCopy(lease.stateCoherence.coherenceReason, "Lease and occupancy signals need human review."),
        contextLabel: baseLabel,
        destination: "/leases",
        source: "Lease operations · occupancy coherence",
        workflowStatus: label(lease.stateCoherence.leaseOperationalState || "review_required"),
        reviewStatus: "Review needed",
        financialStatus: null,
        nextActionLabel: "Review occupancy context",
      });
    }

    if (executionStatus && executionStatus !== "fully_executed" && executionStatus !== "landlord_signed") {
      signals.push({
        id: `lease-execution:${lease.id}`,
        category: "lease_lifecycle",
        severity: executionStatus === "blocked" ? "critical" : "warning",
        priorityGroup: executionStatus === "blocked" ? "critical" : "needs_review",
        title: lease.leaseExecution?.executionLabel || "Lease execution needs review",
        description: lease.leaseExecution?.executionDescription || "Lease execution is not complete.",
        contextLabel: baseLabel,
        destination: "/leases",
        source: "Lease operations · execution readiness",
        workflowStatus: label(executionStatus),
        reviewStatus: "Review needed",
        financialStatus: null,
        nextActionLabel: "Review lease execution",
      });
    }

    if (signatureStatus && signatureStatus !== "signed" && signatureStatus !== "unavailable") {
      signals.push({
        id: `lease-signature:${lease.id}`,
        category: "documents",
        severity: "warning",
        priorityGroup: "needs_review",
        title: lease.signatureReadinessLabel || "Lease signature pending",
        description: lease.signatureReadinessDescription || "Lease package has a pending signature step.",
        contextLabel: baseLabel,
        destination: leaseDestination,
        source: "Lease operations · document readiness",
        workflowStatus: label(signatureStatus),
        reviewStatus: "Review needed",
        financialStatus: null,
        nextActionLabel: "Review lease package",
      });
    }

    if (lease.leasePdfStatus === "not_available" || lease.leasePdfStatus === "pending") {
      signals.push({
        id: `lease-document:${lease.id}`,
        category: "documents",
        severity: lease.leasePdfStatus === "not_available" ? "warning" : "info",
        priorityGroup: lease.leasePdfStatus === "not_available" ? "needs_review" : "informational",
        title: lease.leasePdfLabel || "Lease document package not ready",
        description: lease.leasePdfDescription || "The tenant-facing lease package is not yet available.",
        contextLabel: baseLabel,
        destination: "/leases",
        source: "Lease operations · tenant workspace linkage",
        workflowStatus: label(lease.leasePdfStatus),
        reviewStatus: lease.leasePdfStatus === "not_available" ? "Review needed" : "Informational",
        financialStatus: null,
        nextActionLabel: "Review document context",
      });
    }

    if (lease.paymentReadiness && lease.paymentReadiness.readinessStatus !== "ready_to_configure") {
      signals.push({
        id: `payment-readiness:${lease.id}`,
        category: "payments",
        severity: lease.paymentReadiness.readinessStatus === "blocked" ? "critical" : "warning",
        priorityGroup: lease.paymentReadiness.readinessStatus === "blocked" ? "critical" : "needs_review",
        title: lease.paymentReadiness.readinessLabel || "Payment readiness needs review",
        description: lease.paymentReadiness.readinessDescription || "Review lease payment setup before relying on collection workflow.",
        contextLabel: baseLabel,
        destination: leaseDestination,
        source: "Lease operations · payment readiness",
        workflowStatus: label(lease.paymentReadiness.readinessStatus),
        reviewStatus: "Review needed",
        financialStatus: label(lease.paymentReadiness.readinessStatus),
        nextActionLabel: "Review payment setup",
      });
    }

    if (endingIn != null && endingIn >= 0 && endingIn <= 90) {
      signals.push({
        id: `lease-ending:${lease.id}`,
        category: "lease_lifecycle",
        severity: endingIn <= 30 ? "warning" : "info",
        priorityGroup: "upcoming",
        title: "Lease ending soon",
        description: `Lease ends ${formatDate(lease.endDate)}. Review renewal, notice, or move-out workflow timing.`,
        contextLabel: baseLabel,
        destination: "/leases",
        source: "Lease operations · lifecycle timing",
        workflowStatus: "Upcoming",
        reviewStatus: endingIn <= 30 ? "Needs review" : "Upcoming",
        financialStatus: null,
        nextActionLabel: "Review renewal timing",
      });
    }

    for (const policy of lease.jurisdictionPolicies || []) {
      if (policy.status !== "review") continue;
      signals.push({
        id: `policy:${lease.id}:${policy.policyKey}`,
        category: "lease_lifecycle",
        severity: policy.severity === "critical" ? "critical" : policy.severity === "warning" ? "warning" : "info",
        priorityGroup:
          policy.severity === "critical" ? "critical" : policy.policyKey.includes("renewal") ? "upcoming" : "needs_review",
        title: policy.label,
        description: `${policy.reason} ${policy.disclaimer}`,
        contextLabel: baseLabel,
        destination: "/leases",
        source: `Jurisdiction workflow · ${policy.jurisdiction}`,
        workflowStatus: label(policy.status),
        reviewStatus: "Review needed",
        financialStatus: null,
        nextActionLabel: "Review jurisdiction guidance",
      });
    }
  }

  for (const property of properties) {
    const units = Array.isArray(property.units) ? property.units : [];
    const vacantUnits = units.filter((unit: any) => String(unit?.status || "").toLowerCase() === "vacant").length;
    if (vacantUnits > 0) {
      signals.push({
        id: `property-vacancy:${property.id}`,
        category: "occupancy",
        severity: "info",
        priorityGroup: "informational",
        title: "Vacant units visible",
        description: `${vacantUnits} vacant unit${vacantUnits === 1 ? "" : "s"} may need listing, lease, or follow-up review.`,
        contextLabel: propertyLabel(property),
        destination: "/properties",
        source: "Properties · occupancy display",
        workflowStatus: "Informational",
        reviewStatus: "Informational",
        financialStatus: null,
        nextActionLabel: "Review property occupancy",
      });
    }
  }

  return prioritizeOperationalItems(signals.map(withTriageMetadata));
}

function summarizeByCategory(signals: CommandCenterSignal[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    config: CATEGORY_CONFIG[category],
    total: signals.filter((signal) => signal.category === category).length,
    critical: signals.filter((signal) => signal.category === category && signal.severity === "critical").length,
    warning: signals.filter((signal) => signal.category === category && signal.severity === "warning").length,
    info: signals.filter((signal) => signal.category === category && signal.severity === "info").length,
  }));
}

function summarizeByPriority(signals: CommandCenterSignal[]) {
  return PRIORITY_GROUPS.map((group) => ({
    ...group,
    signals: signals.filter((signal) => signal.priorityGroup === group.group),
  }));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function signalSearchText(signal: CommandCenterSignal) {
  return [
    signal.title,
    signal.description,
    signal.contextLabel,
    CATEGORY_CONFIG[signal.category].label,
    signal.category,
    signal.source,
    signal.workflowStatus,
    signal.reviewStatus,
    signal.financialStatus,
    signal.nextActionLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesCommandCenterFilter(signal: CommandCenterSignal, filter: CommandCenterFilter) {
  if (filter === "all") return true;
  if (filter === "critical") return signal.priorityGroup === "critical" || signal.severity === "critical";
  if (filter === "warnings") return signal.severity === "warning";
  if (filter === "needs_review") return signal.priorityGroup === "needs_review";
  if (filter === "upcoming") return signal.priorityGroup === "upcoming";
  if (filter === "open_decisions") return signal.id.startsWith("decision:");
  if (filter === "delinquent") return signal.category === "payments" || /delinqu|payment evidence/i.test(signal.source);
  if (filter === "informational") return signal.priorityGroup === "informational";
  return true;
}

export function filterOperationalItems(
  signals: CommandCenterSignal[],
  options: CommandCenterFilterOptions
) {
  const query = normalizeSearchText(String(options.search || ""));
  const filter = options.filter || "all";
  return signals.filter((signal) => {
    if (!matchesCommandCenterFilter(signal, filter)) return false;
    if (options.workflowType && options.workflowType !== "all" && signal.category !== options.workflowType) return false;
    if (options.reviewStatus && options.reviewStatus !== "all") {
      const normalizedReview = normalizeSearchText(signal.reviewStatus);
      if (options.reviewStatus === "open" && !signal.id.startsWith("decision:")) return false;
      if (options.reviewStatus === "review_needed" && !/review|need|blocked|open/.test(normalizedReview)) return false;
      if (options.reviewStatus === "informational" && !/informational|upcoming/.test(normalizedReview)) return false;
    }
    if (options.assignment && options.assignment !== "all" && signal.assignmentState !== options.assignment) return false;
    if (options.escalation && options.escalation !== "all" && signal.escalationState !== options.escalation) return false;
    if (options.timingRisk && options.timingRisk !== "all") {
      if (options.timingRisk === "upcoming" && signal.timingState !== "upcoming") return false;
      if (options.timingRisk === "delinquent" && signal.riskState !== "delinquent") return false;
      if (options.timingRisk === "high_risk" && signal.riskState !== "high_risk") return false;
    }
    if (!query) return true;
    return normalizeSearchText(signalSearchText(signal)).includes(query);
  });
}

function filterCopy(options: CommandCenterFilterOptions) {
  const pieces = [
    COMMAND_CENTER_FILTERS.find((item) => item.value === (options.filter || "all"))?.label,
    WORKFLOW_TYPE_OPTIONS.find((item) => item.value === (options.workflowType || "all"))?.label,
    REVIEW_STATUS_OPTIONS.find((item) => item.value === (options.reviewStatus || "all"))?.label,
    ASSIGNMENT_OPTIONS.find((item) => item.value === (options.assignment || "all"))?.label,
    ESCALATION_OPTIONS.find((item) => item.value === (options.escalation || "all"))?.label,
    TIMING_RISK_OPTIONS.find((item) => item.value === (options.timingRisk || "all"))?.label,
    options.search ? `Search: "${options.search}"` : null,
  ].filter(Boolean);
  return pieces.join(" · ");
}

function savedViewFilters(view: SavedOperationalView): Partial<CommandCenterFilterOptions> {
  if (view === "needs_review") return { filter: "needs_review", reviewStatus: "review_needed" };
  if (view === "high_risk") return { filter: "critical", escalation: "escalated" };
  if (view === "upcoming_deadlines") return { filter: "upcoming", timingRisk: "upcoming" };
  if (view === "unassigned") return { filter: "all", assignment: "unassigned" };
  if (view === "delinquent") return { filter: "delinquent", workflowType: "payments", timingRisk: "delinquent" };
  return { filter: "all", workflowType: "all", reviewStatus: "all", assignment: "all", escalation: "all", timingRisk: "all" };
}

function severityTone(severity: CommandCenterSeverity) {
  if (severity === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (severity === "warning") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  return { color: "#075985", background: "#e0f2fe", border: "#bae6fd" };
}

function Badge({ children, severity }: { children: React.ReactNode; severity: CommandCenterSeverity }) {
  const tone = severityTone(severity);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {label(String(children))}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load operational command center";
}

export default function OperationalCommandCenterPage() {
  const [decisionData, setDecisionData] = React.useState<DecisionInboxResponse | null>(null);
  const [dashboardData, setDashboardData] = React.useState<DashboardSummaryData | null>(null);
  const [leases, setLeases] = React.useState<LandlordActiveLease[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [search, setSearch] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<CommandCenterFilter>("all");
  const [activeSavedView, setActiveSavedView] = React.useState<SavedOperationalView>("all_operational");
  const [workflowType, setWorkflowType] = React.useState<WorkflowTypeFilter>("all");
  const [reviewStatus, setReviewStatus] = React.useState<ReviewStatusFilter>("all");
  const [assignment, setAssignment] = React.useState<AssignmentFilter>("all");
  const [escalation, setEscalation] = React.useState<EscalationFilter>("all");
  const [timingRisk, setTimingRisk] = React.useState<TimingRiskFilter>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [decisionResponse, dashboardResponse, leaseResponse, propertyResponse] = await Promise.all([
          fetchDecisionInbox(),
          fetchDashboardSummary(),
          getActiveLeasesForLandlord(),
          fetchProperties({ status: "active" }),
        ]);
        if (!mounted) return;
        setDecisionData(decisionResponse);
        setDashboardData(dashboardResponse);
        setLeases(leaseResponse.leases || []);
        setProperties(propertyResponse.properties || propertyResponse.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(errorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signals = React.useMemo(
    () => deriveCommandCenterSignals({ decisions: decisionData?.items || [], leases, properties }),
    [decisionData?.items, leases, properties]
  );
  const visibleSignals = React.useMemo(
    () => filterOperationalItems(signals, { search, filter: activeFilter, workflowType, reviewStatus, assignment, escalation, timingRisk }),
    [activeFilter, assignment, escalation, reviewStatus, search, signals, timingRisk, workflowType]
  );
  const categorySummary = React.useMemo(() => summarizeByCategory(visibleSignals), [visibleSignals]);
  const prioritySummary = React.useMemo(() => summarizeByPriority(visibleSignals), [visibleSignals]);
  const criticalCount = signals.filter((signal) => signal.severity === "critical").length;
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;
  const activeFilterCopy = filterCopy({ search, filter: activeFilter, workflowType, reviewStatus, assignment, escalation, timingRisk });

  function applySavedView(view: SavedOperationalView) {
    const next = savedViewFilters(view);
    setActiveSavedView(view);
    setActiveFilter(next.filter || "all");
    setWorkflowType(next.workflowType || "all");
    setReviewStatus(next.reviewStatus || "all");
    setAssignment(next.assignment || "all");
    setEscalation(next.escalation || "all");
    setTimingRisk(next.timingRisk || "all");
  }

  function clearFilters() {
    setSearch("");
    applySavedView("all_operational");
  }

  return (
    <MacShell title="Operational command center" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 6, maxWidth: 920 }}>
              <h1 style={{ margin: 0, fontSize: "1.55rem", color: "#0f172a" }}>Operational command center</h1>
              <div style={{ color: "#475569", lineHeight: 1.55 }}>
                Centralized operational visibility across leases, payments, occupancy, screening, documents, and review workflows.
                This page prioritizes source workflow issues only; it does not execute actions, enforce legal timelines, or modify records.
              </div>
            </div>
            <Link to="/decision-inbox" style={{ color: "#2563eb", fontWeight: 900 }}>
              Open decision inbox
            </Link>
          </div>
        </Section>

        <Section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: 10,
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {[
            ["Signals", signals.length],
            ["Critical", criticalCount],
            ["Warnings", warningCount],
            ["Needs review", signals.filter((signal) => signal.priorityGroup === "needs_review").length],
            ["Upcoming", signals.filter((signal) => signal.priorityGroup === "upcoming").length],
            ["Open decisions", decisionData?.summary?.open ?? 0],
            ["Delinquent", dashboardData?.kpis?.delinquentCount ?? 0],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12, boxSizing: "border-box", minWidth: 0 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 24 }}>{value}</strong>
            </Card>
          ))}
        </Section>

        <Section style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>Coordination lanes</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Each lane links back to the source workflow for manual review.</div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Read-only coordination layer</div>
          </div>
          <div
            data-testid="operations-coordination-lanes"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              alignItems: "stretch",
              gap: 12,
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {categorySummary.map(({ category, config, total, critical, warning, info }) => {
              const Icon = config.icon;
              return (
                <Link
                  key={category}
                  to={config.destination}
                  style={{
                    color: "inherit",
                    textDecoration: "none",
                    display: "flex",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <Card
                    style={{
                      borderRadius: 8,
                      padding: 14,
                      display: "grid",
                      alignContent: "start",
                      gap: 8,
                      width: "100%",
                      minHeight: 150,
                      minWidth: 0,
                      boxSizing: "border-box",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={18} />
                      <strong style={{ color: "#0f172a" }}>{config.label}</strong>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{config.description}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                      <span>{total} total</span>
                      <span>{critical} critical</span>
                      <span>{warning} warning</span>
                      <span>{info} info</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Section>

        <Section style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Building2 size={18} />
            <strong style={{ color: "#0f172a" }}>Priority routing queue</strong>
            <span style={{ color: "#64748b", fontSize: 13 }}>Highest priority first by urgency, severity, and source workflow.</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Search operational items
              <input
                aria-label="Search operational items"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by tenant, property, unit, workflow, category, or status"
                style={{
                  width: "100%",
                  minWidth: 0,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "#0f172a",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#334155", fontSize: 13, fontWeight: 900 }}>Saved operational views</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Saved operational views">
                {SAVED_OPERATIONAL_VIEWS.map((view) => {
                  const selected = activeSavedView === view.value;
                  return (
                    <button
                      key={view.value}
                      type="button"
                      onClick={() => applySavedView(view.value)}
                      title={view.description}
                      style={{
                        border: selected ? "1px solid #0f172a" : "1px solid #cbd5e1",
                        background: selected ? "#0f172a" : "#fff",
                        color: selected ? "#fff" : "#334155",
                        borderRadius: 999,
                        padding: "7px 11px",
                        fontSize: 13,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {view.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#334155", fontSize: 13, fontWeight: 900 }}>Priority filters</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Operational item filters">
              {COMMAND_CENTER_FILTERS.map((filter) => {
                const selected = activeFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setActiveSavedView("all_operational");
                      setActiveFilter(filter.value);
                    }}
                    style={{
                      border: selected ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                      background: selected ? "#dbeafe" : "#fff",
                      color: selected ? "#1d4ed8" : "#334155",
                      borderRadius: 999,
                      padding: "7px 11px",
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                gap: 10,
                minWidth: 0,
              }}
            >
              {[
                {
                  label: "Workflow type",
                  value: workflowType,
                  options: WORKFLOW_TYPE_OPTIONS,
                  onChange: (value: string) => setWorkflowType(value as WorkflowTypeFilter),
                },
                {
                  label: "Review status",
                  value: reviewStatus,
                  options: REVIEW_STATUS_OPTIONS,
                  onChange: (value: string) => setReviewStatus(value as ReviewStatusFilter),
                },
                {
                  label: "Assignment state",
                  value: assignment,
                  options: ASSIGNMENT_OPTIONS,
                  onChange: (value: string) => setAssignment(value as AssignmentFilter),
                },
                {
                  label: "Escalation state",
                  value: escalation,
                  options: ESCALATION_OPTIONS,
                  onChange: (value: string) => setEscalation(value as EscalationFilter),
                },
                {
                  label: "Timing / risk",
                  value: timingRisk,
                  options: TIMING_RISK_OPTIONS,
                  onChange: (value: string) => setTimingRisk(value as TimingRiskFilter),
                },
              ].map((control) => (
                <label key={control.label} style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                  {control.label}
                  <select
                    aria-label={control.label}
                    value={control.value}
                    onChange={(event) => {
                      setActiveSavedView("all_operational");
                      control.onChange(event.target.value);
                    }}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "9px 10px",
                      fontSize: 14,
                      color: "#0f172a",
                      background: "#fff",
                      boxSizing: "border-box",
                    }}
                  >
                    {control.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Active view: {activeFilterCopy}</span>
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Reset filters
              </button>
            </div>
          </div>
          {loading ? <Card>Loading operational signals...</Card> : null}
          {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
          {!loading && !error && signals.length === 0 ? (
            <Card style={{ color: "#64748b" }}>No high-signal operational issues are currently visible.</Card>
          ) : null}
          {!loading && !error && signals.length > 0 && visibleSignals.length === 0 ? (
            <Card style={{ color: "#64748b", boxSizing: "border-box", display: "grid", gap: 6 }}>
              <strong style={{ color: "#0f172a" }}>No operational items match this triage view.</strong>
              <span>Current filters: {activeFilterCopy}.</span>
              <span>Adjust the view or reset filters to return to the full operational queue.</span>
            </Card>
          ) : null}
          {!loading && !error && visibleSignals.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              {prioritySummary.map((group) => (
                <div key={group.group} style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Badge severity={group.tone}>{group.label}</Badge>
                        <strong style={{ color: "#0f172a" }}>{group.signals.length} item{group.signals.length === 1 ? "" : "s"}</strong>
                      </div>
                      <span style={{ color: "#64748b", fontSize: 13 }}>{group.description}</span>
                    </div>
                  </div>
                  {group.signals.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {group.signals.map((signal) => (
                        <Card
                          key={signal.id}
                          style={{
                            borderRadius: 8,
                            padding: 14,
                            display: "grid",
                            gap: 8,
                            minWidth: 0,
                            boxSizing: "border-box",
                            overflowWrap: "anywhere",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <Badge severity={signal.severity}>{signal.severity}</Badge>
                              <span style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                                {CATEGORY_CONFIG[signal.category].label}
                              </span>
                              <span style={{ color: "#64748b", fontSize: 13 }}>{signal.source}</span>
                            </div>
                            <Link to={signal.destination} style={{ color: "#2563eb", fontWeight: 900 }}>
                              Open source workflow
                            </Link>
                          </div>
                          <div style={{ display: "grid", gap: 4 }}>
                            <strong style={{ color: "#0f172a", fontSize: 16 }}>{signal.title}</strong>
                            <span style={{ color: "#64748b", fontSize: 13 }}>Context: {signal.contextLabel}</span>
                            <span style={{ color: "#475569", lineHeight: 1.5 }}>Why: {signal.description}</span>
                            <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 900 }}>
                              Next action: {signal.nextActionLabel}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 800 }}>
                            <span>Workflow status: {signal.workflowStatus}</span>
                            <span>Review status: {signal.reviewStatus}</span>
                            {signal.financialStatus ? <span>Financial status: {signal.financialStatus}</span> : null}
                            <span>Assignment: {signal.assignmentLabel || "Unassigned"}</span>
                            <span>Escalation: {signal.escalationLabel || "Not escalated"}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card style={{ color: "#64748b", borderRadius: 8, boxSizing: "border-box" }}>
                      No {group.label.toLowerCase()} items currently visible.
                    </Card>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      </div>
    </MacShell>
  );
}
