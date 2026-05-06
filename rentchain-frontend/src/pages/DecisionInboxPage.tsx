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
} from "@/api/decisionInboxApi";
import type { OperatorReviewEvidenceReference, OperatorReviewScope } from "@/api/operatorReviewApi";
import { evidencePackPath } from "@/api/evidencePackApi";
import { MacShell } from "@/components/layout/MacShell";
import { OperatorReviewSessionPanel } from "@/components/operatorReviews/OperatorReviewSessionPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

type FilterValue<T extends string> = T | "all";

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
  if (severity === "medium") return { color: "#9a3412", background: "#ffedd5", border: "#fed7aa" };
  if (severity === "low") return { color: "#075985", background: "#e0f2fe", border: "#bae6fd" };
  if (severity === "info") return { color: "#334155", background: "#f1f5f9", border: "#cbd5e1" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function statusTone(status: DecisionInboxStatus) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "open") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "pending") return { color: "#1d4ed8", background: "#dbeafe", border: "#bfdbfe" };
  if (status === "resolved") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "dismissed") return { color: "#475569", background: "#f1f5f9", border: "#cbd5e1" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function workflowStateTone(state: DecisionWorkflowState) {
  if (state === "escalated") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (state === "waiting_context") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (state === "under_review") return { color: "#1d4ed8", background: "#dbeafe", border: "#bfdbfe" };
  if (state === "resolved") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (state === "archived") return { color: "#475569", background: "#f1f5f9", border: "#cbd5e1" };
  return { color: "#334155", background: "#f8fafc", border: "#e2e8f0" };
}

function escalationTone(level: DecisionWorkflowEscalationLevel) {
  if (level === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (level === "urgent") return { color: "#9f1239", background: "#ffe4e6", border: "#fecdd3" };
  if (level === "attention") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
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

function DecisionInboxCard({ item }: { item: DecisionInboxItem }) {
  const delinquencyActions = item.delinquencyActions || [];
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
    <Card style={{ display: "grid", gap: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge tone={severityTone(item.severity)}>{label(item.severity)}</Badge>
        <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
        <Badge tone={workflowStateTone(item.workflow.workflowState)}>{label(item.workflow.workflowState)}</Badge>
        <Badge tone={escalationTone(item.workflow.escalationLevel)}>
          {item.workflow.escalationLevel === "none" ? "No escalation" : label(item.workflow.escalationLevel)}
        </Badge>
        <span style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>{label(item.type)}</span>
        <span style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>{label(item.workflow.queue)}</span>
        <span style={{ color: "#64748b", fontSize: 13 }}>Source: {label(item.source)}</span>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ color: "#0f172a", fontSize: 17, fontWeight: 800 }}>{item.title}</div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>{item.description}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          Related: {item.relatedEntity?.label || "Context unavailable"}
        </span>
        {item.destination ? (
          <Link to={item.destination} style={{ color: "#2563eb", fontWeight: 800 }}>
            View context
          </Link>
        ) : (
          <span style={{ color: "#64748b", fontSize: 13 }}>No context link available</span>
        )}
        <Link
          to={evidencePackPath({ scope: reviewScope, scopeId: item.id })}
          style={{ color: "#2563eb", fontWeight: 800 }}
        >
          Preview evidence
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
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ color: "#0f172a" }}>{action.label}</strong>
                  <span style={{ color: action.status === "available" ? "#166534" : "#92400e", fontSize: 12, fontWeight: 900 }}>
                    {label(action.status)}
                  </span>
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>{action.description}</div>
                {action.actionKey === "prepare_notice" ? (
                  <div style={{ color: "#7c2d12", fontSize: 12 }}>
                    Draft only. Review local legal requirements before use.
                  </div>
                ) : null}
                {action.blockedReason ? (
                  <div style={{ color: "#92400e", fontSize: 12 }}>{action.blockedReason}</div>
                ) : null}
                {action.status === "available" && action.destination ? (
                  <Link to={action.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                    Open manual context
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <OperatorReviewSessionPanel
        scope={reviewScope}
        scopeId={item.id}
        linkedEvidence={evidence}
      />
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
    <label style={{ display: "grid", gap: 5, color: "#334155", fontSize: 13, fontWeight: 800 }}>
      {labelText}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as FilterValue<T>)}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "8px 10px",
          color: "#0f172a",
          background: "#fff",
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
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Decision inbox</h1>
              <div style={{ color: "#475569", maxWidth: 900 }}>
                A read-only view of detected decisions across analytics and lease ledger surfaces. Review context here without
                triggering workflow actions.
              </div>
            </div>
            <Link to="/institution-exports" style={{ color: "#2563eb", fontWeight: 800 }}>
              Institution export preview
            </Link>
          </div>
        </Section>

        {data ? (
          <Section style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
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
              ].map(([name, value]) => (
                <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
                  <strong style={{ color: "#0f172a", fontSize: 22 }}>{value}</strong>
                </Card>
              ))}
            </div>
          </Section>
        ) : null}

        <Section style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
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

        {loading ? <Card>Loading decision inbox…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load the decision inbox right now.</Card> : null}
        {!loading && !error && data?.items.length === 0 ? (
          <Card style={{ color: "#64748b" }}>No decisions match the current filters.</Card>
        ) : null}
        {!loading && !error && data?.items.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {data.items.map((item) => (
              <DecisionInboxCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
