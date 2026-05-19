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

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
    signals.push({
      id: `decision:${item.id}`,
      category,
      severity: severityFromDecision(item),
      priorityGroup: priorityFromDecision(item, category),
      title: item.title || "Operational review item",
      description: item.description || "Review the source workflow before taking any action.",
      contextLabel: resolveDecisionContextLabel(item, lookups),
      destination: item.destination || CATEGORY_CONFIG[category].destination,
      source: `Decision inbox · ${label(item.workflow?.queue || "general_review")}`,
      workflowStatus: label(item.workflow?.workflowState || "new"),
      reviewStatus: label(item.status || "open"),
      financialStatus: category === "payments" ? "Review required" : null,
      nextActionLabel: nextActionForDecision(item, category),
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
        title: lease.stateCoherence.coherenceLabel || "Occupancy review needed",
        description: lease.stateCoherence.coherenceReason || "Lease and occupancy signals need human review.",
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

  return prioritizeOperationalItems(signals);
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
  const categorySummary = React.useMemo(() => summarizeByCategory(signals), [signals]);
  const prioritySummary = React.useMemo(() => summarizeByPriority(signals), [signals]);
  const criticalCount = signals.filter((signal) => signal.severity === "critical").length;
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;

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

        <Section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {[
            ["Signals", signals.length],
            ["Critical", criticalCount],
            ["Warnings", warningCount],
            ["Needs review", signals.filter((signal) => signal.priorityGroup === "needs_review").length],
            ["Upcoming", signals.filter((signal) => signal.priorityGroup === "upcoming").length],
            ["Open decisions", decisionData?.summary?.open ?? 0],
            ["Delinquent", dashboardData?.kpis?.delinquentCount ?? 0],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 24 }}>{value}</strong>
            </Card>
          ))}
        </Section>

        <Section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>Coordination lanes</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Each lane links back to the source workflow for manual review.</div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Read-only coordination layer</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {categorySummary.map(({ category, config, total, critical, warning, info }) => {
              const Icon = config.icon;
              return (
                <Link
                  key={category}
                  to={config.destination}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <Card style={{ borderRadius: 8, padding: 14, display: "grid", gap: 8, height: "100%" }}>
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

        <Section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Building2 size={18} />
            <strong style={{ color: "#0f172a" }}>Priority routing queue</strong>
            <span style={{ color: "#64748b", fontSize: 13 }}>Highest priority first by urgency, severity, and source workflow.</span>
          </div>
          {loading ? <Card>Loading operational signals...</Card> : null}
          {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}
          {!loading && !error && signals.length === 0 ? (
            <Card style={{ color: "#64748b" }}>No high-signal operational issues are currently visible.</Card>
          ) : null}
          {!loading && !error && signals.length ? (
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
                        <Card key={signal.id} style={{ borderRadius: 8, padding: 14, display: "grid", gap: 8 }}>
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
                            <span style={{ color: "#475569", lineHeight: 1.5 }}>{signal.description}</span>
                            <span style={{ color: "#64748b", fontSize: 13 }}>Context: {signal.contextLabel}</span>
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 800 }}>
                            <span>Workflow status: {signal.workflowStatus}</span>
                            <span>Review status: {signal.reviewStatus}</span>
                            {signal.financialStatus ? <span>Financial status: {signal.financialStatus}</span> : null}
                            <span>Next action: {signal.nextActionLabel}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card style={{ color: "#64748b", borderRadius: 8 }}>No {group.label.toLowerCase()} items currently visible.</Card>
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
