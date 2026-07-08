import React from "react";
import { Link } from "react-router-dom";
import {
  fetchDecisionInbox,
  type DecisionInboxItem,
  type DecisionInboxResponse,
  type DecisionInboxSeverity,
  type DecisionInboxStatus,
  type DecisionInboxType,
  type DecisionWorkflowEscalationLevel,
  type DecisionWorkflowQueue,
  type DecisionWorkflowState,
  type AutomatedWorkflowStatus,
} from "@/api/decisionInboxApi";
import type { OperatorReviewEvidenceReference, OperatorReviewScope } from "@/api/operatorReviewApi";
import { evidencePackPath } from "@/api/evidencePackApi";
import { reviewTimelinePath } from "@/api/reviewTimelineApi";
import { MacShell } from "@/components/layout/MacShell";
import { AgentActionPanel } from "@/components/agentActions/AgentActionPanel";
import { OperatorReviewSessionPanel } from "@/components/operatorReviews/OperatorReviewSessionPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";
import "./DecisionInboxPage.css";

type FilterValue<T extends string> = T | "all";

const decisionInboxTheme = {
  paper: "#f7f1e7",
  panel: "rgba(255, 252, 246, 0.96)",
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  border: "rgba(91, 70, 48, 0.18)",
  borderStrong: "rgba(91, 70, 48, 0.28)",
  charcoal: "#211c17",
  muted: "#63594d",
  subtle: "#7a6b5c",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
  sage: "#58735f",
  sageSoft: "rgba(88, 115, 95, 0.14)",
  amber: "#8a5a16",
  amberSoft: "#fff3d6",
  clay: "#9d3f32",
  claySoft: "#fde7df",
} as const;

const severityOptions: Array<FilterValue<DecisionInboxSeverity>> = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "info",
  "unknown",
];
const statusOptions: Array<FilterValue<DecisionInboxStatus>> = [
  "all",
  "open",
  "pending",
  "blocked",
  "resolved",
  "dismissed",
  "unknown",
];
const typeOptions: Array<FilterValue<DecisionInboxType>> = [
  "all",
  "lease",
  "screening",
  "maintenance",
  "compliance",
  "admin",
  "property",
  "tenant",
  "billing",
  "unknown",
];
const queueOptions: Array<FilterValue<DecisionWorkflowQueue>> = [
  "all",
  "lease_review",
  "delinquency_review",
  "screening_review",
  "maintenance_review",
  "compliance_review",
  "admin_review",
  "general_review",
];
const workflowStateOptions: Array<FilterValue<DecisionWorkflowState>> = [
  "all",
  "new",
  "triaged",
  "under_review",
  "waiting_context",
  "escalated",
  "resolved",
  "archived",
];
const escalationOptions: Array<FilterValue<DecisionWorkflowEscalationLevel>> = [
  "all",
  "none",
  "attention",
  "urgent",
  "critical",
];

function label(value: string) {
  if (value === "all") return "All";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function severityTone(severity: DecisionInboxSeverity) {
  if (severity === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (severity === "high") return { color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" };
  if (severity === "medium") return { color: decisionInboxTheme.amber, background: decisionInboxTheme.amberSoft, border: "#e9c77a" };
  if (severity === "low") return { color: decisionInboxTheme.pine, background: decisionInboxTheme.pineSoft, border: "rgba(36, 88, 66, 0.28)" };
  if (severity === "info") return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.borderStrong };
  return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.border };
}

function statusTone(status: DecisionInboxStatus) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "open") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "pending") return { color: decisionInboxTheme.pine, background: decisionInboxTheme.sageSoft, border: "rgba(88, 115, 95, 0.3)" };
  if (status === "resolved") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "dismissed") return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.borderStrong };
  return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.border };
}

function workflowStateTone(state: DecisionWorkflowState) {
  if (state === "escalated") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (state === "waiting_context") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (state === "under_review") return { color: decisionInboxTheme.pine, background: decisionInboxTheme.sageSoft, border: "rgba(88, 115, 95, 0.3)" };
  if (state === "resolved") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (state === "archived") return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.borderStrong };
  return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.border };
}

function escalationTone(level: DecisionWorkflowEscalationLevel) {
  if (level === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (level === "urgent") return { color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" };
  if (level === "attention") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  return { color: decisionInboxTheme.muted, background: decisionInboxTheme.cardStrong, border: decisionInboxTheme.border };
}

function automationStatusTone(status: AutomatedWorkflowStatus) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "pending") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "derived") return { color: decisionInboxTheme.pine, background: decisionInboxTheme.sageSoft, border: "rgba(88, 115, 95, 0.3)" };
  return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
}

function Badge({ children, tone }: { children: React.ReactNode; tone: { color: string; background: string; border: string } }) {
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function looksLikeInternalId(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  if (/^[a-z]+:[A-Za-z0-9:_-]{8,}$/i.test(raw)) return true;
  if (/^[a-z]+_[a-z]+:[A-Za-z0-9:_-]{8,}$/i.test(raw)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return true;
  if (/^[A-Za-z0-9_-]{18,}$/.test(raw) && /[A-Z]/.test(raw) && /[a-z]/.test(raw) && /\d/.test(raw)) return true;
  return false;
}

function hasRawReferenceLabel(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  if (looksLikeInternalId(raw)) return true;
  return /^(Lease|Property|Decision|Tenant|Unit)\s+[A-Za-z0-9:_-]+$/i.test(raw);
}

function workflowQueueLabel(queue: string) {
  if (queue === "delinquency_review") return "delinquency review";
  if (queue === "lease_review") return "lease readiness review";
  if (queue === "screening_review") return "screening workflow review";
  if (queue === "maintenance_review") return "maintenance review";
  if (queue === "compliance_review") return "compliance review";
  if (queue === "admin_review") return "admin review";
  return label(queue).toLowerCase();
}

function operationalReviewLabel(input: { value: string; queue?: string }) {
  const raw = input.value.toLowerCase();
  if (raw.includes("review_missing_payment") || raw.includes("missing_payment")) return "Missing payment review";
  if (raw.includes("reduce_vacancy_risk") || raw.includes("vacancy")) return "Vacancy pressure review";
  if (raw.includes("revenue")) return "Revenue pressure review";
  if (raw.includes("delinquency") || input.queue === "delinquency_review") return "Delinquency review";
  if (raw.includes("screening") || input.queue === "screening_review") return "Screening workflow review";
  if (raw.includes("lease") || input.queue === "lease_review") return "Lease readiness review";
  return "Operational review";
}

function safeRelatedLabel(item: DecisionInboxItem) {
  const raw = item.relatedEntity?.label || "";
  if (raw && !hasRawReferenceLabel(raw)) return raw;
  if (item.destination?.startsWith("/leases/")) return "Lease context review";
  return operationalReviewLabel({ value: raw || item.id, queue: item.workflow.queue });
}

function isLeaseLedgerDestination(destination: string | null | undefined) {
  return /^\/leases\/[^/]+\/ledger(?:$|[?#])/.test(String(destination || "").trim());
}

function contextLinkLabel(destination: string | null | undefined) {
  return isLeaseLedgerDestination(destination) ? "Open payment ledger" : "View context";
}

function safeAutomationReason(reason: string, item: DecisionInboxItem) {
  const routedMatch = reason.match(/^Decision\s+(.+?)\s+is routed to\s+([a-z_]+)\.?$/i);
  if (routedMatch) {
    return `${operationalReviewLabel({ value: routedMatch[1], queue: item.workflow.queue })} is routed to ${workflowQueueLabel(
      routedMatch[2]
    )}.`;
  }
  return reason.replace(/\b(Lease|Property|Decision|Tenant|Unit)\s+[A-Za-z0-9:_-]{8,}\b/gi, (_, kind: string) => {
    if (String(kind).toLowerCase() === "lease") return "Lease context review";
    if (String(kind).toLowerCase() === "property") return "Property review";
    return operationalReviewLabel({ value: item.id, queue: item.workflow.queue });
  });
}

function DecisionInboxCard({ item }: { item: DecisionInboxItem }) {
  const delinquencyActions = item.delinquencyActions || [];
  const automatedWorkflow = item.automatedWorkflow;
  const reviewScope: OperatorReviewScope = item.workflow.queue === "delinquency_review" ? "delinquency" : "decision";
  const evidence: OperatorReviewEvidenceReference[] = [
    {
      evidenceId: item.id,
      label: item.title,
      kind: "decision",
      destination: item.destination,
    },
  ];
  if (item.destination) {
    evidence.push({
      evidenceId: `${item.id}:context`,
      label: "Decision context",
      kind: item.workflow.queue === "delinquency_review" ? "ledger" : "workflow",
      destination: item.destination,
    });
  }
  return (
    <Card className="rc-decision-inbox-card" style={{ display: "grid", gap: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge tone={severityTone(item.severity)}>{label(item.severity)}</Badge>
        <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
        <Badge tone={workflowStateTone(item.workflow.workflowState)}>{label(item.workflow.workflowState)}</Badge>
        <Badge tone={escalationTone(item.workflow.escalationLevel)}>
          {item.workflow.escalationLevel === "none" ? "No escalation" : label(item.workflow.escalationLevel)}
        </Badge>
        <span style={{ color: decisionInboxTheme.muted, fontSize: 13, fontWeight: 700 }}>{label(item.type)}</span>
        <span style={{ color: decisionInboxTheme.muted, fontSize: 13, fontWeight: 700 }}>{label(item.workflow.queue)}</span>
        <span style={{ color: decisionInboxTheme.subtle, fontSize: 13 }}>Source: {label(item.source)}</span>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ color: decisionInboxTheme.charcoal, fontSize: 17, fontWeight: 800 }}>{item.title}</div>
        <div style={{ color: decisionInboxTheme.muted, lineHeight: 1.55 }}>{item.description}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: decisionInboxTheme.subtle, fontSize: 13 }}>
          Related: {safeRelatedLabel(item)}
        </span>
        {item.destination ? (
          <Link className="rc-decision-inbox-link" to={item.destination} style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}>
            {contextLinkLabel(item.destination)}
          </Link>
        ) : (
          <span style={{ color: decisionInboxTheme.subtle, fontSize: 13 }}>No context link available</span>
        )}
        <Link
          className="rc-decision-inbox-link"
          to={evidencePackPath({ scope: reviewScope, scopeId: item.id })}
          style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}
        >
          Preview evidence
        </Link>
        <Link
          className="rc-decision-inbox-link"
          to={reviewTimelinePath({ scope: reviewScope, scopeId: item.id })}
          style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}
        >
          View timeline
        </Link>
      </div>
      {delinquencyActions.length ? (
        <div
          style={{
            border: "1px solid #fed7aa",
            background: "#fff7ed",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: "#9a3412", fontWeight: 900 }}>Manual review required</div>
            <div style={{ color: "#7c2d12", fontSize: 13 }}>
              No automated notice or payment action will be taken.
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {delinquencyActions.map((action) => (
              <div
                key={action.actionKey}
                style={{
                  display: "grid",
                  gap: 4,
                  border: "1px solid #fed7aa",
                  borderRadius: 8,
                  padding: 10,
                  background: decisionInboxTheme.card,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ color: decisionInboxTheme.charcoal }}>{action.label}</strong>
                  <span style={{ color: action.status === "available" ? "#166534" : "#92400e", fontSize: 12, fontWeight: 900 }}>
                    {label(action.status)}
                  </span>
                </div>
                <div style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>{action.description}</div>
                {action.actionKey === "prepare_notice" ? (
                  <div style={{ color: "#7c2d12", fontSize: 12 }}>
                    Draft only. Review local legal requirements before use.
                  </div>
                ) : null}
                {action.blockedReason ? (
                  <div style={{ color: "#92400e", fontSize: 12 }}>{action.blockedReason}</div>
                ) : null}
                {action.status === "available" && action.destination ? (
                  <Link className="rc-decision-inbox-link" to={action.destination} style={{ color: decisionInboxTheme.pine, fontWeight: 800, fontSize: 13 }}>
                    {contextLinkLabel(action.destination)}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {automatedWorkflow ? (
        <div
          style={{
            border: `1px solid ${decisionInboxTheme.borderStrong}`,
            background: decisionInboxTheme.sageSoft,
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: decisionInboxTheme.pine }}>Deterministic workflow orchestration only.</strong>
              <span style={{ color: decisionInboxTheme.pine, fontSize: 13 }}>
                No tenant communication, payment action, or legal enforcement is automated. Manual review remains required.
              </span>
            </div>
            <Badge tone={automationStatusTone(automatedWorkflow.status)}>{label(automatedWorkflow.status)}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <div style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>
              <strong>Workflow type:</strong> {label(automatedWorkflow.workflowType)}
            </div>
            <div style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>
              <strong>Transition:</strong> {label(automatedWorkflow.transition.fromState)} to {label(automatedWorkflow.transition.toState)}
            </div>
            <div style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>
              <strong>Policy guarded:</strong> {automatedWorkflow.policyGuarded ? "Yes" : "No"}
            </div>
            <div style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>
              <strong>External execution:</strong> {automatedWorkflow.externalExecutionEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <strong style={{ color: decisionInboxTheme.pine, fontSize: 13 }}>Review automation reasoning</strong>
            {automatedWorkflow.reasons.slice(0, 3).map((reason) => (
              <span key={reason} style={{ color: decisionInboxTheme.muted, fontSize: 13 }}>
                {safeAutomationReason(reason, item)}
              </span>
            ))}
            {automatedWorkflow.blockedReasons.map((reason) => (
              <span key={reason} style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rc-decision-inbox-agent-actions">
        <AgentActionPanel actions={item.agentActions} />
      </div>
      <div className="rc-decision-inbox-review-panel">
        <OperatorReviewSessionPanel
          scope={reviewScope}
          scopeId={item.id}
          linkedEvidence={evidence}
        />
      </div>
    </Card>
  );
}

function FilterSelect<T extends string>({
  labelText,
  value,
  options,
  onChange,
}: {
  labelText: string;
  value: FilterValue<T>;
  options: Array<FilterValue<T>>;
  onChange: (value: FilterValue<T>) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 5, color: decisionInboxTheme.muted, fontSize: 13, fontWeight: 800 }}>
      {labelText}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as FilterValue<T>)}
        style={{
          border: `1px solid ${decisionInboxTheme.borderStrong}`,
          borderRadius: 8,
          padding: "8px 10px",
          color: decisionInboxTheme.charcoal,
          background: decisionInboxTheme.card,
          minWidth: 150,
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load decision inbox";
}

export default function DecisionInboxPage() {
  const { showToast } = useToast();
  const [severity, setSeverity] = React.useState<FilterValue<DecisionInboxSeverity>>("all");
  const [status, setStatus] = React.useState<FilterValue<DecisionInboxStatus>>("all");
  const [type, setType] = React.useState<FilterValue<DecisionInboxType>>("all");
  const [queue, setQueue] = React.useState<FilterValue<DecisionWorkflowQueue>>("all");
  const [workflowState, setWorkflowState] = React.useState<FilterValue<DecisionWorkflowState>>("all");
  const [escalationLevel, setEscalationLevel] = React.useState<FilterValue<DecisionWorkflowEscalationLevel>>("all");
  const [data, setData] = React.useState<DecisionInboxResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchDecisionInbox({ severity, status, type, queue, workflowState, escalationLevel });
        if (!mounted) return;
        setData(response);
      } catch (err) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({ message: "Failed to load decision inbox", description: message, variant: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [severity, status, type, queue, workflowState, escalationLevel, showToast]);

  return (
    <MacShell title="Decision inbox" showTopNav={false}>
      <div className="rc-decision-inbox-page" style={{ display: "grid", gap: 16 }}>
        <Section className="rc-decision-inbox-hero">
          <div
            className="rc-decision-inbox-header"
            style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}
          >
            <div className="rc-decision-inbox-heading" style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Decision inbox</h1>
              <div style={{ color: decisionInboxTheme.muted, maxWidth: 900 }}>
                A read-only view of detected decisions across analytics and lease ledger surfaces. Review context here without
                triggering workflow actions.
              </div>
            </div>
            <div className="rc-decision-inbox-context-links">
              <Link className="rc-decision-inbox-link" to="/institution-exports" style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}>
                Institution export preview
              </Link>
              <Link className="rc-decision-inbox-link" to="/agent-supervision" style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}>
                Agent supervision
              </Link>
              <Link className="rc-decision-inbox-link" to="/identity-layer" style={{ color: decisionInboxTheme.pine, fontWeight: 800 }}>
                Identity layer
              </Link>
            </div>
          </div>
        </Section>

        {data ? (
          <Section className="rc-decision-inbox-summary" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Summary</div>
            <div
              className="rc-decision-inbox-summary-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}
            >
              {[
                ["Total", data.summary.total],
                ["Critical", data.summary.critical],
                ["High", data.summary.high],
                ["Open", data.summary.open],
                ["Blocked", data.summary.blocked],
                ["New", data.workflowSummary.new],
                ["Under review", data.workflowSummary.underReview],
                ["Escalated", data.workflowSummary.escalated],
                ["Critical workflow", data.workflowSummary.critical],
                ["Workflow previews", data.automationSummary.total],
                ["Review required", data.automationSummary.reviewRequired],
                ["Escalation flags", data.automationSummary.escalationFlagged],
                ["Blocked orchestration", data.automationSummary.blocked],
                ["Agent suggestions", data.agentActionSummary.total],
                ["Suggested actions", data.agentActionSummary.suggested],
                ["Blocked suggestions", data.agentActionSummary.blocked],
                ["Suggestion review required", data.agentActionSummary.reviewRequired],
              ].map(([name, value]) => (
                <Card key={String(name)} className="rc-decision-inbox-summary-card" style={{ borderRadius: 8, padding: 12 }}>
                  <div style={{ color: decisionInboxTheme.subtle, fontSize: 12, fontWeight: 800 }}>{name}</div>
                  <strong style={{ color: decisionInboxTheme.charcoal, fontSize: 22 }}>{value}</strong>
                </Card>
              ))}
            </div>
          </Section>
        ) : null}

        <Section className="rc-decision-inbox-filters" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <FilterSelect labelText="Severity" value={severity} options={severityOptions} onChange={setSeverity} />
          <FilterSelect labelText="Status" value={status} options={statusOptions} onChange={setStatus} />
          <FilterSelect labelText="Type" value={type} options={typeOptions} onChange={setType} />
          <FilterSelect labelText="Queue" value={queue} options={queueOptions} onChange={setQueue} />
          <FilterSelect
            labelText="Workflow state"
            value={workflowState}
            options={workflowStateOptions}
            onChange={setWorkflowState}
          />
          <FilterSelect
            labelText="Escalation"
            value={escalationLevel}
            options={escalationOptions}
            onChange={setEscalationLevel}
          />
        </Section>

        {loading ? <Card className="rc-decision-inbox-state-card">Loading decision inbox…</Card> : null}
        {!loading && error ? <Card className="rc-decision-inbox-state-card" style={{ color: "#b91c1c" }}>We couldn't load the decision inbox right now.</Card> : null}
        {!loading && !error && data?.items.length === 0 ? (
          <Card className="rc-decision-inbox-state-card" style={{ color: decisionInboxTheme.subtle }}>No decisions match the current filters.</Card>
        ) : null}
        {!loading && !error && data?.items.length ? (
          <div className="rc-decision-inbox-list" style={{ display: "grid", gap: 12 }}>
            {data.items.map((item) => (
              <DecisionInboxCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
